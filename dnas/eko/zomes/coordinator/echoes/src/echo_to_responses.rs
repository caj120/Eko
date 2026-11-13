use hc_link_pagination::{paginate_by_hash, HashPagination};
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;
use echoes_integrity::*;

#[derive(Serialize, Deserialize, Debug)]
pub struct AddResponseForEchoInput {
    pub base_original_echo_hash: ActionHash,
    pub target_response_echo_hash: ActionHash,
    pub response_type: ResponseType,
}
#[hdk_extern]
pub fn add_response_for_echo(input: AddResponseForEchoInput) -> ExternResult<()> {
    let tag: SerializedBytes = input.response_type.try_into().map_err(|_| {
        wasm_error!(WasmErrorInner::Guest(
            "Failed to seriailize response_type".into()
        ))
    })?;

    create_link(
        input.base_original_echo_hash.clone(),
        input.target_response_echo_hash,
        LinkTypes::EchoToResponses,
        tag.bytes().clone(),
    )?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetResponsesForEchoInput {
    pub original_echo_hash: ActionHash,
    pub response_type: Option<ResponseType>,
    pub page: Option<HashPagination>,
}
#[hdk_extern]
pub fn get_response_hashes_for_echo(
    input: ZomeFnInput<GetResponsesForEchoInput>,
) -> ExternResult<Vec<ActionHash>> {
    let strategy = input.get_strategy();
    let tag = match input.input.response_type {
        Some(response_type) => {
            let tag: SerializedBytes = response_type.try_into().map_err(|_| {
                wasm_error!(WasmErrorInner::Guest(
                    "Failed to seriailize response_type".into()
                ))
            })?;

            Some(LinkTag::from(tag.bytes().clone()))
        }
        None => None,
    };

    let mut query = LinkQuery::new(
        AnyLinkableHash::from(input.input.original_echo_hash),
        LinkTypes::EchoToResponses.try_into_filter()?,
    );
    if let Some(t) = tag {
        query = query.tag_prefix(t);
    }

    let links = get_links(query, strategy)?;
    let links_page = paginate_by_hash(links, input.input.page)?;
    let hashes: Vec<ActionHash> = links_page
        .into_iter()
        .filter_map(|link| ActionHash::try_from(link.target).ok())
        .collect();

    Ok(hashes)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CountResponsesForEchoInput {
    pub original_echo_hash: ActionHash,
    pub response_type: Option<ResponseType>,
}
#[hdk_extern]
pub fn count_responses_for_echo(input: CountResponsesForEchoInput) -> ExternResult<usize> {
    let maybe_tag = match input.response_type {
        Some(response_type) => {
            let tag: SerializedBytes = response_type.try_into().map_err(|_| {
                wasm_error!(WasmErrorInner::Guest(
                    "Failed to seriailize response_type".into()
                ))
            })?;

            Some(LinkTag::from(tag.bytes().clone()))
        }
        None => None,
    };

    let mut query = LinkQuery::new(
        input.original_echo_hash,
        LinkTypes::EchoToResponses.try_into_filter()?,
    );

    if let Some(tag) = maybe_tag {
        query = query.tag_prefix(tag)
    }

    count_links(query)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetResponseForEchoExistsInput {
    pub original_echo_hash: ActionHash,
    pub response_type: Option<ResponseType>,
    pub response_author: AgentPubKey,
}
#[hdk_extern]
pub fn get_response_for_echo_exists(input: GetResponseForEchoExistsInput) -> ExternResult<bool> {
    let maybe_tag = match input.response_type {
        Some(response_type) => {
            let tag: SerializedBytes = response_type.try_into().map_err(|_| {
                wasm_error!(WasmErrorInner::Guest(
                    "Failed to seriailize response_type".into()
                ))
            })?;

            Some(LinkTag::from(tag.bytes().clone()))
        }
        None => None,
    };

    let mut query = LinkQuery::new(
        input.original_echo_hash.clone(),
        LinkTypes::EchoToResponses.try_into_filter()?,
    )
    .author(input.response_author);

    if let Some(tag) = maybe_tag {
        query = query.tag_prefix(tag)
    }

    let count = count_links(query)?;

    Ok(count > 0)
}

#[hdk_extern]
pub fn get_responses_for_echo(
    input: ZomeFnInput<GetResponsesForEchoInput>,
) -> ExternResult<Vec<Record>> {
    let get_options = input.get_options();
    let response_hashes = get_response_hashes_for_echo(input)?;
    let get_input: Vec<GetInput> = response_hashes
        .into_iter()
        .map(|hash| GetInput::new(hash.into(), get_options.clone()))
        .collect();
    let records: Vec<Record> = HDK
        .with(|hdk| hdk.borrow().get(get_input))?
        .into_iter()
        .flatten()
        .collect();
    Ok(records)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RemoveResponseForEchoInput {
    pub base_original_echo_hash: ActionHash,
    pub target_response_echo_hash: ActionHash,
}
#[hdk_extern]
pub fn remove_response_for_echo(input: RemoveResponseForEchoInput) -> ExternResult<()> {
    let links = get_links(
        LinkQuery::new(
            AnyLinkableHash::from(input.base_original_echo_hash),
            LinkTypes::EchoToResponses.try_into_filter()?,
        ),
        GetStrategy::Local,
    )?;
    for link in links {
        let action_hash =
            ActionHash::try_from(link.target.clone()).map_err(|err| wasm_error!(err))?;
        if action_hash.eq(&input.target_response_echo_hash) {
            delete_link(link.create_link_hash, GetOptions::local())?;
        }
    }
    Ok(())
}
