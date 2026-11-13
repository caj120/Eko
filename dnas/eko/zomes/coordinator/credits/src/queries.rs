use crate::credit::build_credit_with_context;
use credit_types::*;
use credits_integrity::*;
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;
use ledger_types::{CreditLine, CreditLineBasis};

/// Resolve one index to credit hashes, oldest first.
fn credit_hashes_at(
    base: AnyLinkableHash,
    link_type: LinkTypes,
    strategy: GetStrategy,
) -> ExternResult<Vec<ActionHash>> {
    let mut links = get_links(LinkQuery::new(base, link_type.try_into_filter()?), strategy)?;
    links.sort_by_key(|link| link.timestamp);

    Ok(links
        .into_iter()
        .filter_map(|link| ActionHash::try_from(link.target).ok())
        .collect())
}

/// Hydrate credit hashes into cards, newest first, skipping any that cannot be
/// fetched with the given strategy.
fn cards_for(
    hashes: Vec<ActionHash>,
    strategy: GetStrategy,
) -> ExternResult<Vec<CreditWithContext>> {
    let mut cards: Vec<CreditWithContext> = hashes
        .into_iter()
        .filter_map(|hash| build_credit_with_context(hash, strategy).ok().flatten())
        .filter(|card| card.deleted_timestamp.is_none())
        .collect();
    cards.sort_by_key(|card| std::cmp::Reverse(card.timestamp));

    Ok(cards)
}

/// Credits an agent has received. This is the track record.
#[hdk_extern]
pub fn get_credits_for_recipient(
    input: ZomeFnInput<AgentPubKey>,
) -> ExternResult<Vec<CreditWithContext>> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        input.input.clone().into(),
        LinkTypes::RecipientToCredits,
        strategy,
    )?;

    cards_for(hashes, strategy)
}

/// Credits an agent has given.
#[hdk_extern]
pub fn get_credits_by_author(
    input: ZomeFnInput<AgentPubKey>,
) -> ExternResult<Vec<CreditWithContext>> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        input.input.clone().into(),
        LinkTypes::AuthorToCredits,
        strategy,
    )?;

    cards_for(hashes, strategy)
}

/// Global credits feed.
#[hdk_extern]
pub fn get_all_credits(input: ZomeFnInput<()>) -> ExternResult<Vec<CreditWithContext>> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        Path::from(ALL_CREDITS_PATH).path_entry_hash()?.into(),
        LinkTypes::AllCredits,
        strategy,
    )?;

    cards_for(hashes, strategy)
}

/// Credits attached to one echo.
#[hdk_extern]
pub fn get_credits_for_echo(
    input: ZomeFnInput<ActionHash>,
) -> ExternResult<Vec<CreditWithContext>> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        input.input.clone().into(),
        LinkTypes::EchoToCredits,
        strategy,
    )?;

    cards_for(hashes, strategy)
}

/// Every credit citing one external token, e.g. Credit #77449.
#[hdk_extern]
pub fn get_credits_for_credit_ref(
    input: ZomeFnInput<CreditRefQuery>,
) -> ExternResult<Vec<CreditWithContext>> {
    let strategy = input.get_strategy();
    let credit_ref = CreditRef {
        collection: input.input.collection.clone(),
        token_id: input.input.token_id.clone(),
        chain: None,
    };
    let hashes = credit_hashes_at(
        credit_ref_path(&credit_ref).path_entry_hash()?.into(),
        LinkTypes::CreditRefToCredits,
        strategy,
    )?;

    cards_for(hashes, strategy)
}

/// How many credits an agent has received.
///
/// Cheap: counts index links without fetching each entry. Retracted credits
/// remove their links, so the count tracks live acknowledgments. Use this for
/// threshold logic (for example, unlocking something at 4+ credits).
#[hdk_extern]
pub fn count_credits_for_recipient(input: ZomeFnInput<AgentPubKey>) -> ExternResult<usize> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        input.input.clone().into(),
        LinkTypes::RecipientToCredits,
        strategy,
    )?;

    Ok(hashes.len())
}

/// How many distinct agents have credited this agent.
///
/// A count of acknowledgments can be inflated by one enthusiastic author, so
/// this is the more meaningful number for a reputation surface.
#[hdk_extern]
pub fn count_distinct_crediters(input: ZomeFnInput<AgentPubKey>) -> ExternResult<usize> {
    let strategy = input.get_strategy();
    let hashes = credit_hashes_at(
        input.input.clone().into(),
        LinkTypes::RecipientToCredits,
        strategy,
    )?;

    let mut authors: Vec<AgentPubKey> = hashes
        .into_iter()
        .filter_map(|hash| build_credit_with_context(hash, strategy).ok().flatten())
        .filter(|card| card.deleted_timestamp.is_none())
        .map(|card| card.author)
        .collect();
    authors.sort();
    authors.dedup();

    Ok(authors.len())
}

/// The bridge from the reputation layer to the livelihood layer.
///
/// Turns acknowledgments other people signed into a mutual-credit line. Uses
/// distinct crediters rather than raw credit count, so a single enthusiastic
/// author cannot inflate somebody's borrowing power.
///
/// Nothing here moves value. It states what a community would be willing to
/// extend; a ledger backend decides whether to honour it. See EKO.md.
#[hdk_extern]
pub fn get_credit_line(input: ZomeFnInput<AgentPubKey>) -> ExternResult<CreditLine> {
    let agent = input.input.clone();
    let crediters = count_distinct_crediters(input)?;

    let basis = CreditLineBasis::DistinctCrediters {
        crediters,
        per_crediter: CREDIT_LINE_PER_CREDITER,
        ceiling: CREDIT_LINE_CEILING,
    };

    Ok(CreditLine {
        agent,
        limit: basis.limit(),
        basis,
    })
}

/// Smallest units of credit line extended per distinct crediter.
/// Placeholder: a real community sets this, it is not a constant of nature.
pub const CREDIT_LINE_PER_CREDITER: u64 = 1_000;

/// Hard cap regardless of how many people vouch.
pub const CREDIT_LINE_CEILING: u64 = 25_000;
