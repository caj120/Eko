use hdi::prelude::*;
use echo_types::EchoType;

pub fn validate_create_link_echo_to_responses(
    _action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let base_ah = ActionHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(base_ah.clone())?;
    let _echo: crate::Echo = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference an entry"
        ))))?;
    let target_ah = ActionHash::try_from(target_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(target_ah)?;
    let response_echo: crate::Echo = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference an entry"
        ))))?;

    match response_echo.echo_type {
        EchoType::Reply(original_echo_ah)
        | EchoType::Quote(original_echo_ah)
        | EchoType::Reecho(original_echo_ah) => {
            if original_echo_ah != base_ah {
                return Ok(ValidateCallbackResult::Invalid("Response echo referenced action hash is different from linked response action hash".into()));
            }
        }
        _ => {}
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_link_echo_to_responses(
    action: DeleteLink,
    original_action: CreateLink,
    _base: AnyLinkableHash,
    _target: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != original_action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the author can create their EchoToResponses links".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_response_to_echoes(
    _action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    let action_hash = ActionHash::try_from(base_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(action_hash)?;
    let _echo: crate::Echo = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference an entry"
        ))))?;
    let action_hash = ActionHash::try_from(target_address).map_err(|err| wasm_error!(err))?;
    let record = must_get_valid_record(action_hash)?;
    let _echo: crate::Echo = record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Linked action must reference an entry"
        ))))?;
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_link_response_to_echoes(
    action: DeleteLink,
    original_action: CreateLink,
    _base: AnyLinkableHash,
    _target: AnyLinkableHash,
    _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != original_action.author {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the author can create their ResponseToEchoes links".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
