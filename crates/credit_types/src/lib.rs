use hc_link_pagination::Timestamped;
use hdk::prelude::*;

/// An optional, UNVERIFIED pointer to an external token that motivated this
/// acknowledgment (e.g. a Credits NFT).
///
/// Holochain validation is deterministic and has no network access, so a zome
/// can never confirm that the author holds this token. The reference is
/// therefore a *claim by the author*, nothing more. It carries no implication
/// of identity, ownership, or entitlement to proceeds — and the acknowledgment
/// it sits on remains valid if the token is later transferred or burned.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct CreditRef {
    /// Collection slug, e.g. "credits".
    pub collection: String,
    /// Token identifier as a string, e.g. "77449".
    pub token_id: String,
    /// Optional chain hint, e.g. "base". Display only.
    pub chain: Option<String>,
}

impl CreditRef {
    /// Stable, lowercase index key. Used as the path component for the
    /// CreditRefToCredits index so every credit citing the same token lands
    /// under one anchor.
    pub fn index_key(&self) -> String {
        format!(
            "{}:{}",
            self.collection.trim().to_lowercase(),
            self.token_id.trim().to_lowercase()
        )
    }
}

/// A public acknowledgment, authored by one agent, of another agent's
/// contribution.
///
/// Immutable by design: it lives on the author's source chain, signed by them.
/// The recipient cannot edit or remove it, and it does not depend on any
/// external chain remaining in a particular state.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct HumanCredit {
    /// Who is being acknowledged.
    pub recipient: AgentPubKey,
    /// What they contributed, in the author's words.
    pub contribution: String,
    /// Optional unverified external token reference. See [`CreditRef`].
    pub credit_ref: Option<CreditRef>,
    /// Optional mew this acknowledgment is attached to.
    pub attached_to: Option<ActionHash>,
}

/// A credit plus the context the UI needs to render a card.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CreditWithContext {
    pub credit: HumanCredit,
    pub action: Action,
    pub action_hash: ActionHash,
    pub author: AgentPubKey,
    pub timestamp: Timestamp,
    pub deleted_timestamp: Option<Timestamp>,
}

impl Timestamped for CreditWithContext {
    fn timestamp(&self) -> Timestamp {
        self.timestamp
    }
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CreditInput {
    pub recipient: AgentPubKey,
    pub contribution: String,
    pub credit_ref: Option<CreditRef>,
    pub attached_to: Option<ActionHash>,
}

impl From<CreditInput> for HumanCredit {
    fn from(input: CreditInput) -> Self {
        HumanCredit {
            recipient: input.recipient,
            contribution: input.contribution,
            credit_ref: input.credit_ref,
            attached_to: input.attached_to,
        }
    }
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CreditRefQuery {
    pub collection: String,
    pub token_id: String,
}
