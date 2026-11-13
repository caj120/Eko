use crate::dna_properties::*;
use echo_types::*;
use hdi::prelude::*;

pub fn validate_create_echo(
    action: EntryCreationAction,
    echo: Echo,
) -> ExternResult<ValidateCallbackResult> {
    let properties = get_dna_properties(())?;

    // Validate min & max echo length by DNA properties setting
    match echo.echo_type {
        EchoType::Original | EchoType::Reply(_) | EchoType::Quote(_) => {
            if let Some(echo_characters_min) = properties.echo_characters_min {
                if echo.text.len() < echo_characters_min {
                    return Ok(ValidateCallbackResult::Invalid(format!(
                        "echo must contain at least {echo_characters_min} characters"
                    )));
                }
            }

            // Validate maximum echo length, if set in DNA properties
            if let Some(echo_characters_max) = properties.echo_characters_max {
                if echo.text.len() > echo_characters_max {
                    return Ok(ValidateCallbackResult::Invalid(format!(
                        "echo must contain at most {echo_characters_max} characters"
                    )));
                }
            }
        }
        EchoType::Reecho(original_echo_ah) => {
            if !echo.text.is_empty() {
                return Ok(ValidateCallbackResult::Invalid(
                    "Reecho cannot contain text".into(),
                ));
            }

            if *action.action_seq() > 5 {
                let agent_activity = must_get_agent_activity(
                    action.author().clone(),
                    ChainFilter::new(action.prev_action().clone()).include_cached_entries(),
                )?;

                let has_identical_reechos = agent_activity
                    .into_iter()
                    .filter_map(|agent_activity| {
                        match agent_activity.action.action().action_type() {
                            ActionType::Create => agent_activity
                                .action
                                .clone()
                                .action()
                                .entry_type()
                                .and_then(|entry_type: &EntryType| match entry_type.clone() {
                                    EntryType::App(app_entry_def) => {
                                        match (app_entry_def.zome_index, app_entry_def.entry_index)
                                        {
                                            (ZomeIndex(1), EntryDefIndex(0)) => {
                                                Some(agent_activity)
                                            }
                                            _ => None,
                                        }
                                    }
                                    _ => None,
                                }),
                            _ => None,
                        }
                    })
                    .filter_map(|agent_activity| {
                        agent_activity
                            .action
                            .action()
                            .entry_data()
                            .and_then(|(entry_hash, ..)| {
                                must_get_entry(entry_hash.clone())
                                    .ok()
                                    .and_then(|entry| Echo::try_from(entry.as_content()).ok())
                            })
                    })
                    .any(|echo| match echo.echo_type {
                        EchoType::Reecho(ah) => ah == original_echo_ah,
                        _ => false,
                    });

                if has_identical_reechos {
                    return Ok(ValidateCallbackResult::Invalid(
                        "An echo can only be reechoed once".into(),
                    ));
                }
            }
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_update_echo(_action: Update, _echo: Echo) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Invalid(
        "Echoes cannot be updated".into(),
    ))
}

pub fn validate_delete_echo(
    action: Delete,
    original_action: Action,
) -> ExternResult<ValidateCallbackResult> {
    if action.author != *original_action.author() {
        return Ok(ValidateCallbackResult::Invalid(
            "Only the original action author can delete their echo".into(),
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
