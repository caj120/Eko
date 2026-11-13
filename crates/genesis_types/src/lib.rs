//! GENESIS State primitives.
//!
//! A GENESIS State is a community that runs its own identity, reputation,
//! currency and coordination. This crate holds the three entries that make
//! one legible: a charter that says what it is, an admission that says who
//! belongs, and a commitment that says who owes what to whom.
//!
//! See EKO.md for why a charter in this DNA is a *declared* state rather than
//! a sovereign one, and what the cloned-cell path looks like.

use hdk::prelude::*;

/// How an agent becomes a member.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum MembershipRule {
    /// Only the founder admits.
    FounderInvite,
    /// Any existing member may sponsor a newcomer.
    MemberSponsor,
    /// Sponsorship plus a reputation floor.
    ///
    /// NOT ENFORCED IN VALIDATION YET. Doing so requires genesis_integrity to
    /// depend on credits_integrity so it can deserialize credit entries and
    /// count distinct authors. Until then this is a declared policy that
    /// clients honour, not a rule peers enforce.
    CreditThreshold { distinct_crediters: usize },
}

/// How the state decides things. Declared, not yet enforced.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub enum DecisionRule {
    FounderDecides,
    Consent,
    Majority,
}

/// The credit policy a state sets for its own mutual-credit line.
///
/// Mirrors the constants in the credits zome, but per state: a community
/// decides how much borrowing power one vouch is worth inside it.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone, PartialEq, Eq)]
pub struct CreditPolicy {
    pub per_crediter: u64,
    pub ceiling: u64,
}

/// The constitution of a GENESIS State.
///
/// Immutable. An amendment is a new Charter whose `amends` points at the one
/// it replaces, so the history of a state's rules stays readable.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Charter {
    pub name: String,
    pub purpose: String,
    pub membership_rule: MembershipRule,
    pub decision_rule: DecisionRule,
    pub credit_policy: CreditPolicy,
    /// Charter this one replaces, if any.
    pub amends: Option<ActionHash>,
}

/// A record that one agent admitted another to a state.
///
/// Written by the sponsor, never by the newcomer. `sponsor_admission` is the
/// sponsor's own admission to the same state, which makes membership a chain
/// that can be walked back to the founder and verified by any peer. A founder
/// admitting the first members leaves it `None`.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Admission {
    /// Action hash of the founding Charter. This identifies the state.
    pub state: ActionHash,
    pub member: AgentPubKey,
    /// Proof the sponsor is themselves a member. None only for the founder.
    pub sponsor_admission: Option<ActionHash>,
}

/// Something an agent undertakes to do, inside a state.
///
/// This is where a credit gets its provenance. An acknowledgment that points
/// back at a commitment says what was promised as well as what was done.
#[hdk_entry_helper]
#[derive(Clone, PartialEq, Eq)]
pub struct Commitment {
    pub state: ActionHash,
    /// The committer's own admission, proving they are in this state.
    pub committer_admission: ActionHash,
    /// Who it is owed to. None means owed to the state as a whole.
    pub owed_to: Option<AgentPubKey>,
    pub description: String,
    pub due: Option<Timestamp>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CharterInput {
    pub name: String,
    pub purpose: String,
    pub membership_rule: MembershipRule,
    pub decision_rule: DecisionRule,
    pub credit_policy: CreditPolicy,
    pub amends: Option<ActionHash>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct AdmissionInput {
    pub state: ActionHash,
    pub member: AgentPubKey,
    pub sponsor_admission: Option<ActionHash>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct CommitmentInput {
    pub state: ActionHash,
    pub committer_admission: ActionHash,
    pub owed_to: Option<AgentPubKey>,
    pub description: String,
    pub due: Option<Timestamp>,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct StateSummary {
    pub charter: Charter,
    pub charter_hash: ActionHash,
    pub founder: AgentPubKey,
    pub founded_at: Timestamp,
    pub member_count: usize,
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct MemberRecord {
    pub admission: Admission,
    pub admission_hash: ActionHash,
    pub sponsor: AgentPubKey,
    pub admitted_at: Timestamp,
}
