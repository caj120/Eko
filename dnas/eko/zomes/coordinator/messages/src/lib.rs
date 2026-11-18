//! Private messaging and call signaling.
//!
//! Nothing here touches the shared DHT. A message goes straight from the
//! sender to each member with a direct call, and each side keeps its own copy
//! as a private entry on its own source chain. A member who is offline gets
//! the message when the sender (or the app on a later start) retries.
//!
//! Call signaling is ephemeral: WebRTC offers, answers and candidates move as
//! remote signals and are never written anywhere.

pub mod state;

use hdk::prelude::*;
use message_types::*;
use messages_integrity::*;
use state::*;

#[hdk_extern]
pub fn init() -> ExternResult<InitCallbackResult> {
    // Other agents must be able to call these on us without a secret. Both
    // check who is calling before doing anything.
    let zome = zome_info()?.name;
    let functions = vec![
        (zome.clone(), FunctionName::from("receive_message")),
        (zome, FunctionName::from("recv_remote_signal")),
    ]
    .into_iter()
    .collect();
    create_cap_grant(ZomeCallCapGrant {
        tag: "messages".into(),
        access: CapAccess::Unrestricted,
        functions: GrantedFunctions::Listed(functions),
    })?;
    Ok(InitCallbackResult::Pass)
}

fn guest(reason: &str) -> WasmError {
    wasm_error!(WasmErrorInner::Guest(reason.into()))
}

/// All conversations I hold, newest activity first.
#[hdk_extern]
pub fn get_my_conversations(_: ()) -> ExternResult<Vec<ConversationView>> {
    let me = agent_info()?.agent_initial_pubkey;
    let state = load_state()?;
    let mut views: Vec<ConversationView> = state
        .conversations
        .iter()
        .map(|c| conversation_view(c, &state, &me))
        .collect::<ExternResult<Vec<_>>>()?;
    views.sort_by(|a, b| {
        let at = |v: &ConversationView| {
            v.last_message
                .as_ref()
                .map(|m| m.sent_at)
                .unwrap_or(v.created_at)
        };
        at(b).cmp(&at(a))
    });
    Ok(views)
}

/// Open the conversation with one person, creating it if this is the first
/// time. Both people derive the same key, so there is only ever one.
#[hdk_extern]
pub fn open_direct(other: AgentPubKey) -> ExternResult<ConversationView> {
    let me = agent_info()?.agent_initial_pubkey;
    if other == me {
        return Err(guest("You cannot message yourself"));
    }
    let key = direct_key(&me, &other);
    let mut state = load_state()?;
    if state.find_conversation(&key).is_none() {
        create_entry(EntryTypes::Conversation(Conversation {
            key: key.clone(),
            kind: ConversationKind::Direct,
            title: None,
            members: vec![me.clone(), other],
            created_at: sys_time()?,
        }))?;
        state = load_state()?;
    }
    if !state.accepted.contains(&key) {
        create_entry(EntryTypes::ConversationAccepted(ConversationAccepted {
            key: key.clone(),
        }))?;
        state = load_state()?;
    }
    let conversation = state
        .find_conversation(&key)
        .ok_or_else(|| guest("Could not find the conversation just created"))?;
    conversation_view(conversation, &state, &me)
}

/// Start a small named group and send its first message.
#[hdk_extern]
pub fn create_group(input: CreateGroupInput) -> ExternResult<ConversationView> {
    let me = agent_info()?.agent_initial_pubkey;
    let mut members = vec![me.clone()];
    for member in input.members {
        if !members.contains(&member) {
            members.push(member);
        }
    }
    if members.len() < 3 || members.len() > MAX_MEMBERS {
        return Err(guest("A group needs between 3 and 12 people including you"));
    }
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(guest("A group needs a name"));
    }
    let key = format!("grp:{}:{}", me, sys_time()?.as_micros());
    create_entry(EntryTypes::Conversation(Conversation {
        key: key.clone(),
        kind: ConversationKind::Group,
        title: Some(title),
        members,
        created_at: sys_time()?,
    }))?;
    create_entry(EntryTypes::ConversationAccepted(ConversationAccepted {
        key: key.clone(),
    }))?;
    send_message(SendMessageInput {
        conversation_key: key.clone(),
        body: input.first_message,
        reply_to: None,
    })?;
    let state = load_state()?;
    let conversation = state
        .find_conversation(&key)
        .ok_or_else(|| guest("Could not find the group just created"))?;
    conversation_view(conversation, &state, &me)
}

/// Say yes to a conversation that arrived from someone.
#[hdk_extern]
pub fn accept_conversation(key: String) -> ExternResult<()> {
    let state = load_state()?;
    if state.find_conversation(&key).is_none() {
        return Err(guest("Unknown conversation"));
    }
    if !state.accepted.contains(&key) {
        create_entry(EntryTypes::ConversationAccepted(ConversationAccepted {
            key,
        }))?;
    }
    Ok(())
}

/// Messages in one conversation, oldest first.
#[hdk_extern]
pub fn get_messages(key: String) -> ExternResult<Vec<MessageView>> {
    let me = agent_info()?.agent_initial_pubkey;
    let state = load_state()?;
    let mut views = Vec::new();
    for (record, message) in state.messages.iter() {
        if message.conversation_key == key {
            views.push(message_view(record, message, &state, &me)?);
        }
    }
    views.sort_by(|a, b| a.sent_at.cmp(&b.sent_at));
    Ok(views)
}

/// Write a message to my own chain, then try to reach every other member.
/// Members who cannot be reached now stay pending and are retried by
/// `retry_pending`.
#[hdk_extern]
pub fn send_message(input: SendMessageInput) -> ExternResult<MessageView> {
    let me = agent_info()?.agent_initial_pubkey;
    let state = load_state()?;
    let conversation = state
        .find_conversation(&input.conversation_key)
        .ok_or_else(|| guest("Unknown conversation"))?
        .clone();
    if !conversation.members.contains(&me) {
        return Err(guest("You are not in this conversation"));
    }
    if !state.accepted.contains(&conversation.key) {
        return Err(guest("Accept this conversation before replying"));
    }
    let recipients: Vec<AgentPubKey> = conversation
        .members
        .iter()
        .filter(|member| **member != me)
        .cloned()
        .collect();
    let message = ChatMessage {
        conversation_key: conversation.key.clone(),
        from: me.clone(),
        origin: None,
        body: input.body.trim().to_string(),
        reply_to: input.reply_to,
        sent_at: sys_time()?,
        recipients: recipients.clone(),
    };
    let hash = create_entry(EntryTypes::ChatMessage(message.clone()))?;
    deliver(&conversation, &message, &hash, &recipients)?;

    let state = load_state()?;
    let (record, stored) = state
        .messages
        .iter()
        .find(|(record, _)| *record.action_address() == hash)
        .ok_or_else(|| guest("Could not find the message just written"))?;
    message_view(record, stored, &state, &me)
}

/// Try again for everything I sent that has not reached everyone. Returns how
/// many deliveries succeeded. The app calls this on start and on a timer.
#[hdk_extern]
pub fn retry_pending(_: ()) -> ExternResult<u32> {
    let me = agent_info()?.agent_initial_pubkey;
    let state = load_state()?;
    let mut delivered = 0u32;
    for (record, message) in state.messages.iter() {
        if message.from != me {
            continue;
        }
        let pending = pending_for(record, message, &state);
        if pending.is_empty() {
            continue;
        }
        let Some(conversation) = state.find_conversation(&message.conversation_key) else {
            continue;
        };
        delivered += deliver(conversation, message, record.action_address(), &pending)?;
    }
    Ok(delivered)
}

/// Called by another agent to hand me a message. Anyone can call it, so every
/// check lives here.
#[hdk_extern]
pub fn receive_message(wire: WireMessage) -> ExternResult<()> {
    let sender = call_info()?.provenance;
    let me = agent_info()?.agent_initial_pubkey;

    if sender == me {
        return Err(guest("Ignoring a message from myself"));
    }
    if wire.members.len() < 2 || wire.members.len() > MAX_MEMBERS {
        return Err(guest("Bad member list"));
    }
    if !wire.members.contains(&me) || !wire.members.contains(&sender) {
        return Err(guest("Sender and receiver must both be members"));
    }
    if wire.kind == ConversationKind::Direct
        && (wire.members.len() != 2 || wire.conversation_key != direct_key(&me, &sender))
    {
        return Err(guest(
            "A direct conversation must be between sender and receiver",
        ));
    }

    let state = load_state()?;
    // A retry of something I already hold is not an error.
    let already = state
        .messages
        .iter()
        .any(|(_, m)| m.from == sender && m.origin.as_ref() == Some(&wire.origin));
    if already {
        return Ok(());
    }

    if state.find_conversation(&wire.conversation_key).is_none() {
        create_entry(EntryTypes::Conversation(Conversation {
            key: wire.conversation_key.clone(),
            kind: wire.kind.clone(),
            title: wire.title.clone(),
            members: wire.members.clone(),
            created_at: sys_time()?,
        }))?;
    }

    create_entry(EntryTypes::ChatMessage(ChatMessage {
        conversation_key: wire.conversation_key.clone(),
        from: sender.clone(),
        origin: Some(wire.origin),
        body: wire.body,
        reply_to: wire.reply_to,
        sent_at: wire.sent_at,
        recipients: vec![],
    }))?;

    emit_signal(MessagesSignal::NewMessage {
        conversation_key: wire.conversation_key,
        from: sender,
    })?;
    Ok(())
}

/// Send a call signal to some members of a conversation. Nothing is stored.
#[hdk_extern]
pub fn send_call_signal(input: CallSignalInput) -> ExternResult<()> {
    let me = agent_info()?.agent_initial_pubkey;
    let conversations = load_conversations_only()?;
    let conversation = conversations
        .iter()
        .find(|c| c.key == input.conversation_key)
        .ok_or_else(|| guest("Unknown conversation"))?;
    if !conversation.members.contains(&me) {
        return Err(guest("You are not in this conversation"));
    }
    let to: Vec<AgentPubKey> = input
        .to
        .into_iter()
        .filter(|agent| *agent != me && conversation.members.contains(agent))
        .collect();
    if to.is_empty() {
        return Ok(());
    }
    send_remote_signal(
        CallSignalWire {
            conversation_key: input.conversation_key,
            call_id: input.call_id,
            kind: input.kind,
            mode: input.mode,
            payload: input.payload,
        },
        to,
    )
}

/// Receives a call signal and passes it to the UI, but only from someone who
/// is a member of a conversation I hold.
#[hdk_extern]
pub fn recv_remote_signal(wire: CallSignalWire) -> ExternResult<()> {
    let from = call_info()?.provenance;
    let me = agent_info()?.agent_initial_pubkey;
    let conversations = load_conversations_only()?;
    let known = conversations.iter().any(|c| {
        c.key == wire.conversation_key && c.members.contains(&from) && c.members.contains(&me)
    });
    if !known {
        return Ok(());
    }
    emit_signal(MessagesSignal::Call {
        from,
        conversation_key: wire.conversation_key,
        call_id: wire.call_id,
        kind: wire.kind,
        mode: wire.mode,
        payload: wire.payload,
    })
}
