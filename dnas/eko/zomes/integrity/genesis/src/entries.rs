use genesis_types::*;
use hdi::prelude::*;

/// Load a Charter from an action hash, failing if it is not one.
pub fn must_get_charter(charter_hash: &ActionHash) -> ExternResult<Charter> {
    let record = must_get_valid_record(charter_hash.clone())?;
    record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Referenced action is not a Charter"
        ))))
}

/// Load an Admission from an action hash, with its author.
pub fn must_get_admission(
    admission_hash: &ActionHash,
) -> ExternResult<(Admission, AgentPubKey)> {
    let record = must_get_valid_record(admission_hash.clone())?;
    let author = record.action().author().clone();
    let admission: Admission = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Referenced action is not an Admission"
        ))))?;

    Ok((admission, author))
}

pub fn validate_create_charter(
    action: EntryCreationAction,
    charter: Charter,
) -> ExternResult<ValidateCallbackResult> {
    if charter.name.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "A charter must have a name".into(),
        ));
    }

    if charter.purpose.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "A charter must state a purpose".into(),
        ));
    }

    if charter.credit_policy.per_crediter > charter.credit_policy.ceiling {
        return Ok(ValidateCallbackResult::Invalid(
            "A credit policy ceiling cannot be below the per-crediter amount".into(),
        ));
    }

    // An amendment may only be written by the founder of the charter it
    // replaces. Richer amendment paths need the decision rule enforced, which
    // is not built yet.
    if let Some(amends) = &charter.amends {
        let prior = must_get_valid_record(amends.clone())?;
        let _: Charter = prior
            .entry()
            .to_app_option()
            .map_err(|e| wasm_error!(e))?
            .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
                "A charter can only amend another charter"
            ))))?;

        if prior.action().author() != action.author() {
            return Ok(ValidateCallbackResult::Invalid(
                "Only the founder can amend a charter".into(),
            ));
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

/// Membership is a chain of sponsorship rooted in the charter.
///
/// Each admission names the sponsor's own admission, so any peer can walk the
/// chain back to the founder and check every link. Nobody can admit
/// themselves, and nobody outside the state can admit anyone.
pub fn validate_create_admission(
    action: EntryCreationAction,
    admission: Admission,
) -> ExternResult<ValidateCallbackResult> {
    let sponsor = action.author().clone();

    if sponsor == admission.member {
        return Ok(ValidateCallbackResult::Invalid(
            "An agent cannot admit themselves to a state".into(),
        ));
    }

    let charter = must_get_charter(&admission.state)?;
    let founder = must_get_valid_record(admission.state.clone())?
        .action()
        .author()
        .clone();

    match &admission.sponsor_admission {
        // Founder admitting directly.
        None => {
            if sponsor != founder {
                return Ok(ValidateCallbackResult::Invalid(
                    "Only the founder may admit without naming a sponsoring admission".into(),
                ));
            }
        }
        // A member sponsoring a newcomer.
        Some(sponsor_admission_hash) => {
            if let MembershipRule::FounderInvite = charter.membership_rule {
                return Ok(ValidateCallbackResult::Invalid(
                    "This state admits by founder invite only".into(),
                ));
            }

            let (sponsor_admission, _) = must_get_admission(sponsor_admission_hash)?;

            if sponsor_admission.state != admission.state {
                return Ok(ValidateCallbackResult::Invalid(
                    "The sponsoring admission belongs to a different state".into(),
                ));
            }

            if sponsor_admission.member != sponsor {
                return Ok(ValidateCallbackResult::Invalid(
                    "The sponsoring admission must belong to the agent writing this one".into(),
                ));
            }
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_commitment(
    action: EntryCreationAction,
    commitment: Commitment,
) -> ExternResult<ValidateCallbackResult> {
    if commitment.description.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "A commitment must describe what is being undertaken".into(),
        ));
    }

    let (admission, _) = must_get_admission(&commitment.committer_admission)?;

    if admission.state != commitment.state {
        return Ok(ValidateCallbackResult::Invalid(
            "The committer's admission belongs to a different state".into(),
        ));
    }

    if admission.member != *action.author() {
        return Ok(ValidateCallbackResult::Invalid(
            "A commitment must be written by the agent whose admission it cites".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

/// Charters, admissions and commitments are all statements of record.
pub fn validate_no_updates(kind: &str) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Invalid(format!(
        "A {kind} cannot be updated. Write a new one instead."
    )))
}

pub fn validate_author_only_delete(
    action: Delete,
    original_action: Action,
    kind: &str,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != *original_action.author() {
        return Ok(ValidateCallbackResult::Invalid(format!(
            "Only the original author can delete their {kind}"
        )));
    }

    Ok(ValidateCallbackResult::Valid)
}
