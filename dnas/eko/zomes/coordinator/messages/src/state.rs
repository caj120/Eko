use hdk::prelude::*;
use message_types::*;
use messages_integrity::*;
use std::collections::HashSet;

/// Everything this agent holds, read from its own source chain.
pub struct State {
    pub conversations: Vec<Conversation>,
    pub accepted: HashSet<String>,
    pub messages: Vec<(Record, ChatMessage)>,
    pub receipts: Vec<DeliveryReceipt>,
}

impl State {
    pub fn find_conversation(&self, key: &str) -> Option<&Conversation> {
        self.conversations.iter().find(|c| c.key == key)
    }
}

fn records_of(unit: UnitEntryTypes) -> ExternResult<Vec<Record>> {
    query(
        ChainQueryFilter::new()
            .entry_type(EntryType::App(unit.into()))
            .include_entries(true),
    )
}

pub fn load_conversations_only() -> ExternResult<Vec<Conversation>> {
    let mut out = Vec::new();
    for record in records_of(UnitEntryTypes::Conversation)? {
        if let Some(conversation) = record
            .entry()
            .to_app_option::<Conversation>()
            .map_err(|e| wasm_error!(e))?
        {
            out.push(conversation);
        }
    }
    Ok(out)
}

pub fn load_state() -> ExternResult<State> {
    let conversations = load_conversations_only()?;

    let mut accepted = HashSet::new();
    for record in records_of(UnitEntryTypes::ConversationAccepted)? {
        if let Some(entry) = record
            .entry()
            .to_app_option::<ConversationAccepted>()
            .map_err(|e| wasm_error!(e))?
        {
            accepted.insert(entry.key);
        }
    }

    let mut messages = Vec::new();
    for record in records_of(UnitEntryTypes::ChatMessage)? {
        let decoded = record
            .entry()
            .to_app_option::<ChatMessage>()
            .map_err(|e| wasm_error!(e))?;
        if let Some(message) = decoded {
            messages.push((record, message));
        }
    }

    let mut receipts = Vec::new();
    for record in records_of(UnitEntryTypes::DeliveryReceipt)? {
        if let Some(receipt) = record
            .entry()
            .to_app_option::<DeliveryReceipt>()
            .map_err(|e| wasm_error!(e))?
        {
            receipts.push(receipt);
        }
    }

    Ok(State {
        conversations,
        accepted,
        messages,
        receipts,
    })
}

/// Members a message I sent has not reached yet.
pub fn pending_for(record: &Record, message: &ChatMessage, state: &State) -> Vec<AgentPubKey> {
    let hash = record.action_address();
    message
        .recipients
        .iter()
        .filter(|recipient| {
            !state
                .receipts
                .iter()
                .any(|r| r.message == *hash && r.to == **recipient)
        })
        .cloned()
        .collect()
}

pub fn message_view(
    record: &Record,
    message: &ChatMessage,
    state: &State,
    me: &AgentPubKey,
) -> ExternResult<MessageView> {
    let (id, pending) = if message.from == *me {
        (
            MessageId {
                author: me.clone(),
                hash: record.action_address().clone(),
            },
            pending_for(record, message, state),
        )
    } else {
        let hash = message.origin.clone().ok_or_else(|| {
            wasm_error!(WasmErrorInner::Guest(
                "A received message is missing its origin".into()
            ))
        })?;
        (
            MessageId {
                author: message.from.clone(),
                hash,
            },
            vec![],
        )
    };
    Ok(MessageView {
        id,
        conversation_key: message.conversation_key.clone(),
        from: message.from.clone(),
        body: message.body.clone(),
        reply_to: message.reply_to.clone(),
        sent_at: message.sent_at,
        pending,
    })
}

pub fn conversation_view(
    conversation: &Conversation,
    state: &State,
    me: &AgentPubKey,
) -> ExternResult<ConversationView> {
    let mut last: Option<MessageView> = None;
    for (record, message) in state.messages.iter() {
        if message.conversation_key != conversation.key {
            continue;
        }
        let view = message_view(record, message, state, me)?;
        let newer = match &last {
            Some(existing) => view.sent_at > existing.sent_at,
            None => true,
        };
        if newer {
            last = Some(view);
        }
    }
    Ok(ConversationView {
        key: conversation.key.clone(),
        kind: conversation.kind.clone(),
        title: conversation.title.clone(),
        members: conversation.members.clone(),
        created_at: conversation.created_at,
        accepted: state.accepted.contains(&conversation.key),
        last_message: last,
    })
}

/// Hand a message to each target with a direct call and write a receipt for
/// each one that confirms. Returns how many succeeded. A target that is
/// offline simply stays pending.
pub fn deliver(
    conversation: &Conversation,
    message: &ChatMessage,
    hash: &ActionHash,
    targets: &[AgentPubKey],
) -> ExternResult<u32> {
    let wire = WireMessage {
        conversation_key: conversation.key.clone(),
        kind: conversation.kind.clone(),
        title: conversation.title.clone(),
        members: conversation.members.clone(),
        origin: hash.clone(),
        body: message.body.clone(),
        reply_to: message.reply_to.clone(),
        sent_at: message.sent_at,
    };
    let zome = zome_info()?.name;
    let mut delivered = 0u32;
    for target in targets {
        let response = call_remote(
            target.clone(),
            zome.clone(),
            FunctionName::from("receive_message"),
            None,
            wire.clone(),
        );
        if let Ok(ZomeCallResponse::Ok(_)) = response {
            create_entry(EntryTypes::DeliveryReceipt(DeliveryReceipt {
                message: hash.clone(),
                to: target.clone(),
            }))?;
            delivered += 1;
        }
    }
    Ok(delivered)
}
