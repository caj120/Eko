use crate::echo_to_responses::*;
use crate::liker_to_echoes::*;
use crate::liker_to_hashes::IsLikerForHashInput;
use crate::pinner_to_echoes::get_is_hash_pinned;
use echoes_integrity::*;
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;

#[hdk_extern]
pub fn get_echo_with_context(input: ZomeFnInput<ActionHash>) -> ExternResult<FeedEcho> {
    let get_options = input.get_options();
    get_echo_with_context_internal(input.input, get_options)
}

pub fn get_echo_with_context_internal(
    original_echo_hash: ActionHash,
    get_options: GetOptions,
) -> ExternResult<FeedEcho> {
    let response = get_details(original_echo_hash.clone(), get_options.clone())?.ok_or(
        wasm_error!(WasmErrorInner::Guest(String::from("Echo not found"))),
    )?;

    match response {
        Details::Record(RecordDetails {
            record, deletes, ..
        }) => {
            let echo: Echo = record
                .entry()
                .to_app_option()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.into())))?
                .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
                    "Malformed echo"
                ))))?;
            let my_pubkey = agent_info()?.agent_initial_pubkey;

            let replies_count = count_responses_for_echo(CountResponsesForEchoInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Reply),
            })?;
            let is_replied = get_response_for_echo_exists(GetResponseForEchoExistsInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Reply),
                response_author: my_pubkey.clone(),
            })?;

            let quotes_count = count_responses_for_echo(CountResponsesForEchoInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Quote),
            })?;
            let is_quoted = get_response_for_echo_exists(GetResponseForEchoExistsInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Quote),
                response_author: my_pubkey.clone(),
            })?;

            let reechos_count = count_responses_for_echo(CountResponsesForEchoInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Reecho),
            })?;
            let is_reechoed = get_response_for_echo_exists(GetResponseForEchoExistsInput {
                original_echo_hash: original_echo_hash.clone(),
                response_type: Some(ResponseType::Reecho),
                response_author: my_pubkey.clone(),
            })?;

            let likes_count = count_likers_for_echo(original_echo_hash.clone())?;
            let is_likeed = is_liker_for_echo(IsLikerForHashInput {
                liker: my_pubkey,
                hash: original_echo_hash.into(),
            })?;

            let deleted_timestamp = deletes
                .first()
                .map(|first_delete| first_delete.action().timestamp());
            let is_pinned = get_is_hash_pinned(record.action_hashed().hash.clone())?;

            match echo.clone().echo_type {
                EchoType::Original => Ok(FeedEcho {
                    echo,
                    action: record.action().clone(),
                    action_hash: record.signed_action().as_hash().clone(),
                    replies_count,
                    quotes_count,
                    likes_count,
                    reechos_count,
                    deleted_timestamp,
                    is_pinned,
                    is_likeed,
                    is_reechoed,
                    is_replied,
                    is_quoted,
                    original_echo: None,
                }),
                EchoType::Reply(response_to_hash)
                | EchoType::Quote(response_to_hash)
                | EchoType::Reecho(response_to_hash) => {
                    let original_echo_embed =
                        match get_details(response_to_hash.clone(), get_options) {
                            Ok(Some(Details::Record(record_details))) => {
                                let original_echo_deleted_timestamp = record_details
                                    .deletes
                                    .first()
                                    .map(|first_delete| first_delete.action().timestamp());

                                match record_details.record.entry().to_app_option::<Echo>() {
                                    Ok(Some(original_echo)) => Some(EmbedEcho {
                                        echo: original_echo,
                                        action: record_details.record.action().clone(),
                                        action_hash: record_details
                                            .record
                                            .action_hashed()
                                            .clone()
                                            .hash,
                                        deleted_timestamp: original_echo_deleted_timestamp,
                                    }),
                                    _ => {
                                        debug!(
                                            "Malformed original echo {:?}, returning None",
                                            response_to_hash
                                        );
                                        None
                                    }
                                }
                            }
                            _ => {
                                debug!(
                                    "Original echo {:?} unavailable, returning None",
                                    response_to_hash
                                );
                                None
                            }
                        };

                    Ok(FeedEcho {
                        echo,
                        action: record.action().clone(),
                        action_hash: record.signed_action().as_hash().clone(),
                        replies_count,
                        quotes_count,
                        likes_count,
                        reechos_count,
                        deleted_timestamp,
                        is_pinned,
                        is_likeed,
                        is_reechoed,
                        is_replied,
                        is_quoted,
                        original_echo: original_echo_embed,
                    })
                }
            }
        }
        _ => Err(wasm_error!(WasmErrorInner::Guest(
            "Expecting get_details to return record, got entry".into()
        ))),
    }
}

#[hdk_extern]
pub fn get_batch_echoes_with_context(
    input: ZomeFnInput<Vec<ActionHash>>,
) -> ExternResult<Vec<FeedEcho>> {
    let get_options = input.get_options();
    get_batch_echoes_with_context_internal(input.input, get_options)
}

pub fn get_batch_echoes_with_context_internal(
    hashes: Vec<ActionHash>,
    get_options: GetOptions,
) -> ExternResult<Vec<FeedEcho>> {
    Ok(hashes
        .into_iter()
        .filter_map(|hash| {
            match get_echo_with_context_internal(hash.clone(), get_options.clone()) {
                Ok(feed_echo) => Some(feed_echo),
                Err(e) => {
                    debug!("Skipping unavailable echo {:?}: {:?}", hash, e);
                    None
                }
            }
        })
        .collect())
}

#[hdk_extern]
pub fn get_responses_for_echo_with_context(
    input: ZomeFnInput<GetResponsesForEchoInput>,
) -> ExternResult<Vec<FeedEcho>> {
    let get_options = input.get_options();
    let response_hashes = get_response_hashes_for_echo(input)?;

    get_batch_echoes_with_context_internal(response_hashes, get_options)
}
