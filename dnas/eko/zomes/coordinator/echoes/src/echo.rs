use crate::cashtag_to_echoes::*;
use crate::hashtag_to_echoes::*;
use crate::mention_to_echoes::*;
use crate::echo_to_responses::*;
use crate::echo_with_context::get_echo_with_context_internal;
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;
use echoes_integrity::*;
use regex::Regex;

#[hdk_extern]
pub fn create_echo(echo: Echo) -> ExternResult<ActionHash> {
    let echo_hash = create_entry(EntryTypes::Echo(echo.clone()))?;
    let path = Path::from("all_echoes");
    create_link(
        path.path_entry_hash()?,
        echo_hash.clone(),
        LinkTypes::AllEchoes,
        (),
    )?;
    let my_agent_pub_key = agent_info()?.agent_initial_pubkey;
    create_link(my_agent_pub_key, echo_hash.clone(), LinkTypes::AgentEchoes, ())?;
    add_tags_for_echo(echo.clone(), echo_hash.clone())?;

    match echo.echo_type {
        EchoType::Quote(base_original_echo_hash) => {
            add_response_for_echo(AddResponseForEchoInput {
                base_original_echo_hash,
                target_response_echo_hash: echo_hash.clone(),
                response_type: ResponseType::Quote,
            })?;
        }
        EchoType::Reply(base_original_echo_hash) => {
            add_response_for_echo(AddResponseForEchoInput {
                base_original_echo_hash,
                target_response_echo_hash: echo_hash.clone(),
                response_type: ResponseType::Reply,
            })?;
        }
        EchoType::Reecho(base_original_echo_hash) => {
            add_response_for_echo(AddResponseForEchoInput {
                base_original_echo_hash,
                target_response_echo_hash: echo_hash.clone(),
                response_type: ResponseType::Reecho,
            })?;
        }
        _ => {}
    }

    Ok(echo_hash)
}

#[hdk_extern]
pub fn create_echo_with_context(echo: Echo) -> ExternResult<FeedEcho> {
    let action_hash = create_echo(echo)?;
    get_echo_with_context_internal(action_hash, GetOptions::local())
}

#[hdk_extern]
pub fn get_echo(input: ZomeFnInput<ActionHash>) -> ExternResult<Option<Record>> {
    let get_options = input.get_options();
    get(input.input, get_options)
}

#[hdk_extern]
pub fn delete_echo(original_echo_hash: ActionHash) -> ExternResult<ActionHash> {
    let maybe_record = get(original_echo_hash.clone(), GetOptions::default())?;
    if let Some(record) = maybe_record {
        let echo = record
            .entry()
            .to_app_option()
            .map_err(|e| wasm_error!(e))?
            .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
                "Linked action must reference an entry"
            ))))?;
        remove_tags_for_echo(echo, original_echo_hash.clone())?;
    }

    let path_hash = Path::from("all_echoes").path_entry_hash()?;
    let links = get_links(
        LinkQuery::new(path_hash, LinkTypes::AllEchoes.try_into_filter()?),
        GetStrategy::Local,
    )?;
    for link in links {
        let action_hash =
            ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?;
        if action_hash.eq(&original_echo_hash) {
            delete_link(link.create_link_hash, GetOptions::local())?;
        }
    }

    let my_agent_pub_key = agent_info()?.agent_initial_pubkey;
    let links = get_links(
        LinkQuery::new(
            AnyLinkableHash::from(my_agent_pub_key),
            LinkTypes::AgentEchoes.try_into_filter()?,
        ),
        GetStrategy::Local,
    )?;
    for link in links {
        let action_hash =
            ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?;
        if action_hash.eq(&original_echo_hash) {
            delete_link(link.create_link_hash, GetOptions::local())?;
        }
    }

    let links = get_links(
        LinkQuery::new(
            AnyLinkableHash::from(original_echo_hash.clone()),
            LinkTypes::EchoToResponses.try_into_filter()?,
        ),
        GetStrategy::Local,
    )?;
    for link in links {
        let action_hash =
            ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?;
        if action_hash.eq(&original_echo_hash) {
            delete_link(link.create_link_hash, GetOptions::local())?;
        }
    }

    delete_entry(original_echo_hash)
}

fn add_tags_for_echo(echo: Echo, echo_hash: ActionHash) -> ExternResult<()> {
    let (hashtag_regex, cashtag_regex) = tag_regexes()?;
    for regex_match in hashtag_regex.find_iter(&echo.text) {
        add_hashtag_for_echo(AddHashtagForEchoInput {
            base_hashtag: regex_match.as_str().into(),
            target_echo_hash: echo_hash.clone(),
        })?;
    }
    for regex_match in cashtag_regex.find_iter(&echo.text) {
        add_cashtag_for_echo(AddCashtagForEchoInput {
            base_cashtag: regex_match.as_str().into(),
            target_echo_hash: echo_hash.clone(),
        })?;
    }
    for link in echo.links {
        if let LinkTarget::Mention(mention) = link {
            add_mention_for_echo(AddMentionForEchoInput {
                base_mention: mention,
                target_echo_hash: echo_hash.clone(),
            })?;
        }
    }

    Ok(())
}

fn remove_tags_for_echo(echo: Echo, echo_hash: ActionHash) -> ExternResult<()> {
    let (hashtag_regex, cashtag_regex) = tag_regexes()?;
    for regex_match in hashtag_regex.find_iter(&echo.text) {
        remove_hashtag_for_echo(RemoveHashtagForEchoInput {
            base_hashtag: regex_match.as_str().into(),
            target_echo_hash: echo_hash.clone(),
        })?;
    }
    for regex_match in cashtag_regex.find_iter(&echo.text) {
        remove_cashtag_for_echo(RemoveCashtagForEchoInput {
            base_cashtag: regex_match.as_str().into(),
            target_echo_hash: echo_hash.clone(),
        })?;
    }
    for link in echo.links {
        if let LinkTarget::Mention(base_mention) = link {
            remove_mention_for_echo(RemoveMentionForEchoInput {
                base_mention,
                target_echo_hash: echo_hash.clone(),
            })?;
        }
    }

    Ok(())
}

fn tag_regexes() -> ExternResult<(Regex, Regex)> {
    let hashtag_regex = Regex::new(r"#\w+").map_err(|_| {
        wasm_error!(WasmErrorInner::Guest(
            "Failed to create hashtag regex".into()
        ))
    })?;
    let cashtag_regex = Regex::new(r"\$\w+").map_err(|_| {
        wasm_error!(WasmErrorInner::Guest(
            "Failed to create cashtag regex".into()
        ))
    })?;

    Ok((hashtag_regex, cashtag_regex))
}
