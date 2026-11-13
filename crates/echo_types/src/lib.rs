use hc_link_pagination::Timestamped;
use hdk::prelude::*;

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum LinkTarget {
    Mention(AgentPubKey),
    Url(String),
    Record(ActionHash),
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum EchoType {
    Original,
    Reply(ActionHash),
    Quote(ActionHash),
    Reecho(ActionHash),
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub enum ResponseType {
    Reply,
    Quote,
    Reecho,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Echo {
    pub text: String,
    pub links: Vec<LinkTarget>,
    pub echo_type: EchoType,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct FeedEcho {
    pub echo: Echo,
    pub action: Action,
    pub action_hash: ActionHash,
    pub replies_count: usize,
    pub quotes_count: usize,
    pub likes_count: usize,
    pub reechos_count: usize,
    pub deleted_timestamp: Option<Timestamp>,
    pub is_pinned: bool,
    pub is_likeed: bool,
    pub is_reechoed: bool,
    pub is_replied: bool,
    pub is_quoted: bool,
    pub original_echo: Option<EmbedEcho>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct EmbedEcho {
    pub echo: Echo,
    pub action: Action,
    pub action_hash: ActionHash,
    pub deleted_timestamp: Option<Timestamp>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct Notification {
    pub notification_type: NotificationType,
    pub timestamp: Timestamp,
    pub agent: AgentPubKey,
    pub feed_echo: Option<FeedEcho>,
}

impl Timestamped for Notification {
    fn timestamp(&self) -> Timestamp {
        self.timestamp
    }
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub enum NotificationType {
    MyEchoLikeed,
    MyEchoUnlikeed,
    MyEchoPinned,
    MyEchoUnpinned,
    MyEchoResponded,
    MyAgentMentioned,
    MyAgentFollowed,
    MyAgentUnfollowed,
    FollowedYarnResponded,
}
