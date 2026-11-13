use hdi::prelude::*;
use hdk::prelude::Path;

pub fn validate_create_link_all_echoes(
    _action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let action_hash = ActionHash::try_from(target_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(action_hash)?;
    let _echo: crate::Echo = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference an entry"
        ))))?;

    let expected_base_address = Path::from("all_echoes").path_entry_hash()?;
    let base_address_entry_hash =
        EntryHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    if base_address_entry_hash != expected_base_address {
        return Ok(ValidateCallbackResult::Invalid(
            "AllEchoes link must use 'all_echoes' Path as its base".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_link_all_echoes(
    action: DeleteLink,
    original_action: CreateLink,
    _base: AnyLinkableHash,
    _target: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != original_action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original action author can delete their AllEchoes link".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
