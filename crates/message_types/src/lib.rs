use hdk::prelude::*;

/// Most people a conversation can hold. Delivery is one direct call per
/// member, so this stays small on purpose.
pub const MAX_MEMBERS: usize = 12;
pub const MAX_BODY_CHARS: usize = 4000;
pub const MAX_TITLE_CHARS: usize = 80;
pub const MAX_KEY_CHARS: usize = 300;

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum ConversationKind {
    /// Exactly two people.
    Direct,
    /// A small named group.
    Group,
}

/// A conversation as one person holds it. Private: it lives only on this
/// person's own source chain and is never published to the DHT.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Conversation {
    /// Shared by every member, so each member's copy lines up. For a direct
    /// conversation it is derived from the two keys, so both sides agree
    /// without talking first.
    pub key: String,
    pub kind: ConversationKind,
    pub title: Option<String>,
    /// Everyone in the conversation, including the holder of this copy.
    pub members: Vec<AgentPubKey>,
    pub created_at: Timestamp,
}

/// Marks a conversation the holder chose to take part in. A conversation that
/// arrived from a stranger stays a request until this exists.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct ConversationAccepted {
    pub key: String,
}

/// One message, as held by one person. Sent and received messages share this
/// shape. Private, like the conversation.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct ChatMessage {
    pub conversation_key: String,
    pub from: AgentPubKey,
    /// For a received message: the sender's own action hash for it. For a
    /// message I sent this is None and my own action hash is the id.
    pub origin: Option<ActionHash>,
    pub body: String,
    pub reply_to: Option<MessageId>,
    pub sent_at: Timestamp,
    /// For a message I sent: who it must reach. Empty on received messages.
    pub recipients: Vec<AgentPubKey>,
}

/// Written by the sender each time a member confirms they stored the message.
/// What is still undelivered is `recipients` minus these. Append-only, so a
/// retry never has to rewrite an earlier entry.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct DeliveryReceipt {
    pub message: ActionHash,
    pub to: AgentPubKey,
}

/// Identifies a message the same way for everyone in the conversation: the
/// sender, plus the hash of the action where the sender wrote it.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct MessageId {
    pub author: AgentPubKey,
    pub hash: ActionHash,
}

/// What travels from sender to member. Carries enough to start the
/// conversation on the receiving side if it does not exist yet.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct WireMessage {
    pub conversation_key: String,
    pub kind: ConversationKind,
    pub title: Option<String>,
    pub members: Vec<AgentPubKey>,
    pub origin: ActionHash,
    pub body: String,
    pub reply_to: Option<MessageId>,
    pub sent_at: Timestamp,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct MessageView {
    pub id: MessageId,
    pub conversation_key: String,
    pub from: AgentPubKey,
    pub body: String,
    pub reply_to: Option<MessageId>,
    pub sent_at: Timestamp,
    /// Members a message I sent has not reached yet. Always empty for
    /// messages from others.
    pub pending: Vec<AgentPubKey>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct ConversationView {
    pub key: String,
    pub kind: ConversationKind,
    pub title: Option<String>,
    pub members: Vec<AgentPubKey>,
    pub created_at: Timestamp,
    /// False while it is a request from someone I have not accepted.
    pub accepted: bool,
    pub last_message: Option<MessageView>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct SendMessageInput {
    pub conversation_key: String,
    pub body: String,
    pub reply_to: Option<MessageId>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CreateGroupInput {
    pub title: String,
    /// The other members. The caller is added automatically.
    pub members: Vec<AgentPubKey>,
    /// A group exists for others only once something reaches them.
    pub first_message: String,
}

/// How a call is shaped. The signaling is the same for all three; the browser
/// decides who sends media to whom.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum CallMode {
    /// Everyone sends and receives audio and video.
    Video,
    /// Audio only.
    Audio,
    /// The host sends; everyone else watches.
    Broadcast,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum CallSignalKind {
    /// Ring the conversation.
    Invite,
    /// Say yes to an invite.
    Join,
    /// Say no.
    Decline,
    /// WebRTC session description from the caller.
    Offer,
    /// WebRTC session description in reply.
    Answer,
    /// WebRTC network candidate.
    Ice,
    /// Leave the call.
    Leave,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CallSignalInput {
    pub conversation_key: String,
    pub call_id: String,
    pub kind: CallSignalKind,
    pub mode: CallMode,
    pub to: Vec<AgentPubKey>,
    /// SDP or ICE candidate as JSON text. Never stored anywhere.
    pub payload: Option<String>,
}

/// What actually crosses the network for a call signal. Signals are
/// ephemeral: nothing about a call is written to any chain.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CallSignalWire {
    pub conversation_key: String,
    pub call_id: String,
    pub kind: CallSignalKind,
    pub mode: CallMode,
    pub payload: Option<String>,
}

/// Emitted to the UI.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum MessagesSignal {
    NewMessage {
        conversation_key: String,
        from: AgentPubKey,
    },
    Call {
        from: AgentPubKey,
        conversation_key: String,
        call_id: String,
        kind: CallSignalKind,
        mode: CallMode,
        payload: Option<String>,
    },
}

/// Deterministic key for a direct conversation: the same for both people
/// whichever of them opens it first.
pub fn direct_key(a: &AgentPubKey, b: &AgentPubKey) -> String {
    let (x, y) = (a.to_string(), b.to_string());
    if x <= y {
        format!("dm:{x}:{y}")
    } else {
        format!("dm:{y}:{x}")
    }
}
