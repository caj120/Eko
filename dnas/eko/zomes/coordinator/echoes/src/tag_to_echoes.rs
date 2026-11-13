use crate::echo_with_context::get_echo_with_context_internal;
use echoes_integrity::*;
use hc_link_pagination::{paginate_by_hash, HashPagination};
use hdk::prelude::*;

pub fn get_echo_hashes_for_tag(
    tag: String,
    link_type: impl LinkTypeFilterExt,
    page: Option<HashPagination>,
    strategy: GetStrategy,
) -> ExternResult<Vec<ActionHash>> {
    let tag_text = make_tag_text(tag.clone());
    let prefix_index = make_tag_prefix_index()?;
    let result_path: Path = prefix_index.make_result_path(tag_text, Some(tag))?;

    let links = get_links(
        LinkQuery::new(result_path.path_entry_hash()?, link_type.try_into_filter()?),
        strategy,
    )?;
    let links_page = paginate_by_hash(links, page)?;
    let hashes: Vec<ActionHash> = links_page
        .iter()
        .filter_map(|l| ActionHash::try_from(l.target.clone()).ok())
        .collect();

    Ok(hashes)
}

pub fn get_echoes_for_tag_with_context(
    tag: String,
    link_type: impl LinkTypeFilterExt,
    page: Option<HashPagination>,
    get_options: GetOptions,
    strategy: GetStrategy,
) -> ExternResult<Vec<FeedEcho>> {
    let hashes = get_echo_hashes_for_tag(tag, link_type, page, strategy)?;

    // Get echoes with context
    let feedechoes: Vec<FeedEcho> = hashes
        .iter()
        .filter_map(|h| get_echo_with_context_internal(h.clone(), get_options.clone()).ok())
        .collect();

    Ok(feedechoes)
}

pub fn make_tag_text(mut text: String) -> String {
    text.remove(0);

    text
}
