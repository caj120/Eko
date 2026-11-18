use hdi::prelude::*;
pub use message_types::*;

/// Every entry here is private. Authorities never receive the content, so
/// these checks run on the author's own device. They keep a buggy or hostile
/// caller from filling your chain with malformed data.
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type(visibility = "private")]
    Conversation(Conversation),
    #[entry_type(visibility = "private")]
    ConversationAccepted(ConversationAccepted),
    #[entry_type(visibility = "private")]
    ChatMessage(ChatMessage),
    #[entry_type(visibility = "private")]
    DeliveryReceipt(DeliveryReceipt),
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

fn invalid(reason: &str) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Invalid(reason.into()))
}

fn has_duplicates(members: &[AgentPubKey]) -> bool {
    members
        .iter()
        .enumerate()
        .any(|(i, m)| members[..i].contains(m))
}

fn validate_conversation(conversation: &Conversation) -> ExternResult<ValidateCallbackResult> {
    if conversation.key.is_empty() || conversation.key.len() > MAX_KEY_CHARS {
        return invalid("A conversation key must be 1 to 300 characters");
    }
    if conversation.members.len() < 2 || conversation.members.len() > MAX_MEMBERS {
        return invalid("A conversation needs between 2 and 12 members");
    }
    if has_duplicates(&conversation.members) {
        return invalid("A conversation cannot list a member twice");
    }
    if conversation.kind == ConversationKind::Direct && conversation.members.len() != 2 {
        return invalid("A direct conversation has exactly two members");
    }
    if let Some(title) = &conversation.title {
        if title.chars().count() > MAX_TITLE_CHARS {
            return invalid("A title must be 80 characters or fewer");
        }
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_chat_message(message: &ChatMessage) -> ExternResult<ValidateCallbackResult> {
    if message.conversation_key.is_empty() || message.conversation_key.len() > MAX_KEY_CHARS {
        return invalid("A conversation key must be 1 to 300 characters");
    }
    let body = message.body.trim();
    if body.is_empty() {
        return invalid("A message cannot be empty");
    }
    if body.chars().count() > MAX_BODY_CHARS {
        return invalid("A message must be 4000 characters or fewer");
    }
    if message.recipients.len() > MAX_MEMBERS {
        return invalid("Too many recipients");
    }
    Ok(ValidateCallbackResult::Valid)
}

fn validate_entry(entry: EntryTypes) -> ExternResult<ValidateCallbackResult> {
    match entry {
        EntryTypes::Conversation(conversation) => validate_conversation(&conversation),
        EntryTypes::ChatMessage(message) => validate_chat_message(&message),
        EntryTypes::ConversationAccepted(accepted) => {
            if accepted.key.is_empty() || accepted.key.len() > MAX_KEY_CHARS {
                return invalid("A conversation key must be 1 to 300 characters");
            }
            Ok(ValidateCallbackResult::Valid)
        }
        EntryTypes::DeliveryReceipt(_) => Ok(ValidateCallbackResult::Valid),
    }
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, ()>()? {
        FlatOp::StoreEntry(OpEntry::CreateEntry { app_entry, .. }) => validate_entry(app_entry),
        FlatOp::StoreRecord(OpRecord::CreateEntry { app_entry, .. }) => validate_entry(app_entry),
        // Updates, deletes and everything else on your own private chain are
        // yours to make.
        _ => Ok(ValidateCallbackResult::Valid),
    }
}
