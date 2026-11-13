use genesis_integrity::*;
use genesis_types::*;
use hdk::prelude::*;

/// Found a Genesis State by publishing its charter.
///
/// The charter's action hash is the state's identity from here on.
#[hdk_extern]
pub fn found_state(input: CharterInput) -> ExternResult<Record> {
    let charter = Charter {
        name: input.name,
        purpose: input.purpose,
        membership_rule: input.membership_rule,
        decision_rule: input.decision_rule,
        credit_policy: input.credit_policy,
        amends: input.amends.clone(),
    };

    let charter_hash = create_entry(EntryTypes::Charter(charter))?;

    create_link(
        Path::from(ALL_STATES_PATH).path_entry_hash()?,
        charter_hash.clone(),
        LinkTypes::AllStates,
        (),
    )?;

    if let Some(amends) = input.amends {
        create_link(
            amends,
            charter_hash.clone(),
            LinkTypes::CharterToAmendments,
            (),
        )?;
    }

    get(charter_hash, GetOptions::default())?.ok_or(wasm_error!(WasmErrorInner::Guest(
        "Could not find the charter just created".into()
    )))
}

/// Admit an agent to a state.
///
/// Written by the sponsor. Leave `sponsor_admission` as None only when the
/// founder is admitting; otherwise pass your own admission, which is what
/// makes the membership chain verifiable.
#[hdk_extern]
pub fn admit(input: AdmissionInput) -> ExternResult<Record> {
    let admission = Admission {
        state: input.state.clone(),
        member: input.member.clone(),
        sponsor_admission: input.sponsor_admission,
    };

    let admission_hash = create_entry(EntryTypes::Admission(admission))?;

    create_link(
        input.state,
        admission_hash.clone(),
        LinkTypes::StateToMembers,
        (),
    )?;

    create_link(
        input.member,
        admission_hash.clone(),
        LinkTypes::MemberToStates,
        (),
    )?;

    get(admission_hash, GetOptions::default())?.ok_or(wasm_error!(WasmErrorInner::Guest(
        "Could not find the admission just created".into()
    )))
}

/// Undertake to do something inside a state.
#[hdk_extern]
pub fn make_commitment(input: CommitmentInput) -> ExternResult<Record> {
    let commitment = Commitment {
        state: input.state.clone(),
        committer_admission: input.committer_admission,
        owed_to: input.owed_to,
        description: input.description,
        due: input.due,
    };

    let commitment_hash = create_entry(EntryTypes::Commitment(commitment))?;

    create_link(
        input.state,
        commitment_hash.clone(),
        LinkTypes::StateToCommitments,
        (),
    )?;

    create_link(
        agent_info()?.agent_initial_pubkey,
        commitment_hash.clone(),
        LinkTypes::AgentToCommitments,
        (),
    )?;

    get(commitment_hash, GetOptions::default())?.ok_or(wasm_error!(WasmErrorInner::Guest(
        "Could not find the commitment just created".into()
    )))
}
