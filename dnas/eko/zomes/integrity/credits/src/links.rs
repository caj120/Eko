use credit_types::*;
use hdi::prelude::*;
use hdk::prelude::Path;

pub const ALL_CREDITS_PATH: &str = "all_credits";
pub const CREDIT_REFS_PATH: &str = "credit_refs";

/// Path anchor for every credit citing one external token.
pub fn credit_ref_path(credit_ref: &CreditRef) -> Path {
    Path::from(vec![
        Component::from(CREDIT_REFS_PATH),
        Component::from(credit_ref.index_key().as_str()),
    ])
}

/// Load the credit a link points at, with its author.
fn credit_from_target(target_address: AnyLinkableHash) -> ExternResult<(HumanCredit, AgentPubKey)> {
    let action_hash = ActionHash::try_from(target_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(action_hash)?;
    let author = record.action().author().clone();
    let credit: HumanCredit = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference a HumanCredit entry"
        ))))?;

    Ok((credit, author))
}

/// Every index link must be written by the agent who authored the credit.
/// Without this, a third party could stuff another agent's record with links
/// to credits they did not author.
fn require_link_author_is_credit_author(
    link_author: &AgentPubKey,
    credit_author: &AgentPubKey,
) -> Option<ValidateCallbackResult> {
    if link_author != credit_author {
        return Some(ValidateCallbackResult::Invalid(
            "A credit index link must be authored by the author of the credit".into(),
        ));
    }
    None
}

pub fn validate_create_link_all_credits(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let (_credit, credit_author) = credit_from_target(target_address)?;
    if let Some(invalid) = require_link_author_is_credit_author(&action.author, &credit_author) {
        return Ok(invalid);
    }

    let expected = Path::from(ALL_CREDITS_PATH).path_entry_hash()?;
    let base = EntryHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != expected {
        return Ok(ValidateCallbackResult::Invalid(
            "AllCredits link must use the 'all_credits' Path as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_author_to_credits(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let (_credit, credit_author) = credit_from_target(target_address)?;
    if let Some(invalid) = require_link_author_is_credit_author(&action.author, &credit_author) {
        return Ok(invalid);
    }

    let base = AgentPubKey::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != credit_author {
        return Ok(ValidateCallbackResult::Invalid(
            "AuthorToCredits link must use the credit author as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_recipient_to_credits(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let (credit, credit_author) = credit_from_target(target_address)?;
    if let Some(invalid) = require_link_author_is_credit_author(&action.author, &credit_author) {
        return Ok(invalid);
    }

    let base = AgentPubKey::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != credit.recipient {
        return Ok(ValidateCallbackResult::Invalid(
            "RecipientToCredits link must use the credit's recipient as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_echo_to_credits(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let (credit, credit_author) = credit_from_target(target_address)?;
    if let Some(invalid) = require_link_author_is_credit_author(&action.author, &credit_author) {
        return Ok(invalid);
    }

    let attached_to = match credit.attached_to {
        Some(hash) => hash,
        None => {
            return Ok(ValidateCallbackResult::Invalid(
                "EchoToCredits link requires the credit to set attached_to".into(),
            ));
        }
    };

    let base = ActionHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != attached_to {
        return Ok(ValidateCallbackResult::Invalid(
            "EchoToCredits link must use the credit's attached_to action hash as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_credit_ref_to_credits(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let (credit, credit_author) = credit_from_target(target_address)?;
    if let Some(invalid) = require_link_author_is_credit_author(&action.author, &credit_author) {
        return Ok(invalid);
    }

    let credit_ref = match &credit.credit_ref {
        Some(credit_ref) => credit_ref,
        None => {
            return Ok(ValidateCallbackResult::Invalid(
                "CreditRefToCredits link requires the credit to set credit_ref".into(),
            ));
        }
    };

    let expected = credit_ref_path(credit_ref).path_entry_hash()?;
    let base = EntryHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base != expected {
        return Ok(ValidateCallbackResult::Invalid(
            "CreditRefToCredits link must use the credit_ref's own Path as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

/// All credit index links share one delete rule: only the agent who made the
/// link may remove it.
pub fn validate_delete_credit_link(
    action: DeleteLink,
    original_action: CreateLink,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != original_action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original author can delete their credit index link".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
