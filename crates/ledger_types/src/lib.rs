//! Vocabulary for the mutual-credit layer of Eko.
//!
//! This crate deliberately contains types and no accounting engine. Mutual
//! credit done correctly needs countersigned transactions, so that no agent
//! can move a balance without the counterparty's signature on the same
//! action. That machinery belongs to a ledger backend, not to this app.
//!
//! Eko's job is to hold the vocabulary, decide the credit line, and hand the
//! transaction to the Accounting and Value Flow layer. See EKO.md.

use hdk::prelude::*;

/// Which engine actually settles a transaction.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum LedgerBackend {
    /// A mutual-credit currency supplied by the accounting layer. The
    /// intended default.
    External { currency: String },
    /// A community-scoped ledger running inside this DNA. Requires a
    /// countersigning implementation before it can be trusted.
    Local { currency: String },
}

/// Unit of account. Mutual credit is denominated per community, not globally.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct Unit {
    pub symbol: String,
    pub backend: LedgerBackend,
}

/// A proposed movement of value between two agents.
///
/// Not an entry type yet. It becomes one when a backend is wired up, and when
/// it does it must be written inside a countersigning session so that both
/// `spender` and `recipient` sign the same action. A singly-signed balance
/// change is not mutual credit; it is self-issued money.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct MutualCreditTx {
    pub spender: AgentPubKey,
    pub recipient: AgentPubKey,
    /// Smallest indivisible units, to keep arithmetic exact.
    pub amount: u64,
    pub unit: Unit,
    pub memo: Option<String>,
    /// Optional acknowledgment that occasioned this transaction, linking the
    /// reputation layer to the livelihood layer.
    pub occasioned_by: Option<ActionHash>,
}

/// How far below zero an agent may go.
///
/// In mutual credit the limit is the whole design: it is the community's
/// statement of how much it trusts this agent to make good. Deriving it from
/// acknowledgments other people signed is the point of putting Human Credit
/// underneath it.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct CreditLine {
    pub agent: AgentPubKey,
    /// Negative balance permitted, in smallest units.
    pub limit: u64,
    pub basis: CreditLineBasis,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum CreditLineBasis {
    /// Everyone starts the same.
    Flat { limit: u64 },
    /// Derived from distinct agents who have acknowledged this agent.
    ///
    /// Distinct crediters, not credit count: one enthusiastic author must not
    /// be able to inflate a neighbour's borrowing power.
    DistinctCrediters {
        crediters: usize,
        per_crediter: u64,
        ceiling: u64,
    },
    /// Set by a named community process rather than computed.
    Granted { by: AgentPubKey },
}

impl CreditLineBasis {
    pub fn limit(&self) -> u64 {
        match self {
            CreditLineBasis::Flat { limit } => *limit,
            CreditLineBasis::DistinctCrediters {
                crediters,
                per_crediter,
                ceiling,
            } => (*crediters as u64).saturating_mul(*per_crediter).min(*ceiling),
            CreditLineBasis::Granted { .. } => 0,
        }
    }
}
