use crate::entries::*;
use genesis_types::*;
use hdi::prelude::*;
use hdk::prelude::Path;

pub const ALL_STATES_PATH: &str = "all_states";

fn target_action(target_address: AnyLinkableHash) -> ExternResult<ActionHash> {
    ActionHash::try_from(target_address).map_err(|err| wasm_error!(err))
}

pub fn validate_create_link_all_states(
    _action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let charter_hash = target_action(target_address)?;
    must_get_charter(&charter_hash)?;

    let expected = Path::from(ALL_STATES_PATH).path_entry_hash()?;
    let base = EntryHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != expected {
        return Ok(ValidateCallbackResult::Invalid(
            "AllStates link must use the 'all_states' Path as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

/// The member roster of a state. Base must be the charter the admission names.
pub fn validate_create_link_state_to_members(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let admission_hash = target_action(target_address)?;
    let (admission, admission_author) = must_get_admission(&admission_hash)?;

    if action.author != admission_author {
        return Ok(ValidateCallbackResult::Invalid(
            "A roster link must be written by the sponsor who wrote the admission".into(),
        ));
    }

    let base = target_action(base_address)?;
    if base != admission.state {
        return Ok(ValidateCallbackResult::Invalid(
            "StateToMembers link must use the admission's own state as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

/// The states an agent belongs to. Base must be the admitted member.
pub fn validate_create_link_member_to_states(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let admission_hash = target_action(target_address)?;
    let (admission, admission_author) = must_get_admission(&admission_hash)?;

    if action.author != admission_author {
        return Ok(ValidateCallbackResult::Invalid(
            "A membership link must be written by the sponsor who wrote the admission".into(),
        ));
    }

    let base = AgentPubKey::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != admission.member {
        return Ok(ValidateCallbackResult::Invalid(
            "MemberToStates link must use the admitted member as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

fn validate_commitment_link(
    action: CreateLink,
    target_address: AnyLinkableHash,
) -> ExternResult<(Commitment, ValidateCallbackResult)> {
    let commitment_hash = target_action(target_address)?;
    let record = must_get_valid_record(commitment_hash)?;
    let commitment: Commitment = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action is not a Commitment"
        ))))?;

    if action.author != *record.action().author() {
        return Ok((
            commitment,
            ValidateCallbackResult::Invalid(
                "A commitment link must be written by the committer".into(),
            ),
        ));
    }

    Ok((commitment, ValidateCallbackResult::Valid))
}

pub fn validate_create_link_state_to_commitments(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let (commitment, result) = validate_commitment_link(action, target_address)?;
    if !matches!(result, ValidateCallbackResult::Valid) {
        return Ok(result);
    }

    let base = target_action(base_address)?;
    if base != commitment.state {
        return Ok(ValidateCallbackResult::Invalid(
            "StateToCommitments link must use the commitment's own state as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_agent_to_commitments(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let author = action.author.clone();
    let (_commitment, result) = validate_commitment_link(action, target_address)?;
    if !matches!(result, ValidateCallbackResult::Valid) {
        return Ok(result);
    }

    let base = AgentPubKey::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != author {
        return Ok(ValidateCallbackResult::Invalid(
            "AgentToCommitments link must use the committer as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_charter_to_amendments(
    _action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    let amendment_hash = target_action(target_address)?;
    let amendment = must_get_charter(&amendment_hash)?;

    let base = target_action(base_address)?;
    match amendment.amends {
        Some(amends) if amends == base => Ok(ValidateCallbackResult::Valid),
        _ => Ok(ValidateCallbackResult::Invalid(
            "CharterToAmendments link must use the amended charter as its base".into(),
        )),
    }
}

pub fn validate_delete_genesis_link(
    action: DeleteLink,
    original_action: CreateLink,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != original_action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original author can delete their link".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
