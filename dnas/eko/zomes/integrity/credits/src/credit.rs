use crate::dna_properties::*;
use credit_types::*;
use hdi::prelude::*;

pub fn validate_create_credit(
    action: EntryCreationAction,
    credit: HumanCredit,
) -> ExternResult<ValidateCallbackResult> {
    // You cannot credit yourself. This is the single most important rule for a
    // track record that cannot be manipulated: every acknowledgment on an
    // agent's record was authored by somebody else.
    if *action.author() == credit.recipient {
        return Ok(ValidateCallbackResult::Invalid(
            "An agent cannot credit themselves".into(),
        ));
    }

    let properties = get_credit_dna_properties(())?;
    let trimmed = credit.contribution.trim();

    if let Some(min) = properties.credit_characters_min {
        if trimmed.chars().count() < min {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "A credit must contain at least {min} characters"
            )));
        }
    }

    if let Some(max) = properties.credit_characters_max {
        if trimmed.chars().count() > max {
            return Ok(ValidateCallbackResult::Invalid(format!(
                "A credit must contain at most {max} characters"
            )));
        }
    }

    // An optional credit_ref must at least be well formed. Note that its
    // truth is NOT validated: a zome cannot read an external chain, so the
    // reference is a claim by the author and nothing more.
    if let Some(credit_ref) = &credit.credit_ref {
        if credit_ref.collection.trim().is_empty() || credit_ref.token_id.trim().is_empty() {
            return Ok(ValidateCallbackResult::Invalid(
                "A credit_ref must have a non-empty collection and token_id".into(),
            ));
        }
    }

    // If attached to an echo, that record must exist.
    if let Some(attached_to) = &credit.attached_to {
        must_get_valid_record(attached_to.clone())?;
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_update_credit(
    _action: Update,
    _credit: HumanCredit,
) -> ExternResult<ValidateCallbackResult> {
    // An acknowledgment is a statement made at a point in time. Editing it
    // would let an author rewrite somebody else's record after the fact.
    Ok(ValidateCallbackResult::Invalid(
        "Credits cannot be updated".into(),
    ))
}

pub fn validate_delete_credit(
    action: Delete,
    original_action: Action,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != *original_action.author() {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original author can delete their credit".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
