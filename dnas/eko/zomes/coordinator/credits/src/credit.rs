use credit_types::*;
use credits_integrity::*;
use hdk::prelude::*;

/// Write an acknowledgment and index it.
///
/// The entry lands on the author's own source chain, signed by them. The
/// recipient never gets write access to it, which is what makes the resulting
/// record hard to manipulate.
#[hdk_extern]
pub fn create_credit(input: CreditInput) -> ExternResult<Record> {
    let credit: HumanCredit = input.into();
    let my_agent_pub_key = agent_info()?.agent_initial_pubkey;

    if my_agent_pub_key == credit.recipient {
        return Err(wasm_error!(WasmErrorInner::Guest(
            "You cannot credit yourself".into()
        )));
    }

    let credit_hash = create_entry(EntryTypes::HumanCredit(credit.clone()))?;

    // Global feed
    create_link(
        Path::from(ALL_CREDITS_PATH).path_entry_hash()?,
        credit_hash.clone(),
        LinkTypes::AllCredits,
        (),
    )?;

    // Credits given
    create_link(
        my_agent_pub_key,
        credit_hash.clone(),
        LinkTypes::AuthorToCredits,
        (),
    )?;

    // Credits received — the track record
    create_link(
        credit.recipient.clone(),
        credit_hash.clone(),
        LinkTypes::RecipientToCredits,
        (),
    )?;

    // Attached to an echo, if any
    if let Some(attached_to) = &credit.attached_to {
        create_link(
            attached_to.clone(),
            credit_hash.clone(),
            LinkTypes::EchoToCredits,
            (),
        )?;
    }

    // Grouped by external token reference, if any
    if let Some(credit_ref) = &credit.credit_ref {
        create_link(
            credit_ref_path(credit_ref).path_entry_hash()?,
            credit_hash.clone(),
            LinkTypes::CreditRefToCredits,
            (),
        )?;
    }

    get(credit_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(WasmErrorInner::Guest(
        "Could not find the credit just created".into()
    )))
}

#[hdk_extern]
pub fn get_credit(credit_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(credit_hash, GetOptions::default())
}

/// Retract a credit you authored.
///
/// Index links are removed so counts stay accurate, then the entry is deleted.
/// The delete is a tombstone: peers who already hold the original still see
/// that it existed and was retracted. Nothing is erased from history.
#[hdk_extern]
pub fn delete_credit(credit_hash: ActionHash) -> ExternResult<ActionHash> {
    let record = get(credit_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(
        WasmErrorInner::Guest("Credit not found".into())
    ))?;
    let credit = credit_from_record(&record)?;
    let author = record.action().author().clone();

    let mut bases: Vec<(AnyLinkableHash, LinkTypes)> = vec![
        (
            Path::from(ALL_CREDITS_PATH).path_entry_hash()?.into(),
            LinkTypes::AllCredits,
        ),
        (author.into(), LinkTypes::AuthorToCredits),
        (
            credit.recipient.clone().into(),
            LinkTypes::RecipientToCredits,
        ),
    ];

    if let Some(attached_to) = &credit.attached_to {
        bases.push((attached_to.clone().into(), LinkTypes::EchoToCredits));
    }

    if let Some(credit_ref) = &credit.credit_ref {
        bases.push((
            credit_ref_path(credit_ref).path_entry_hash()?.into(),
            LinkTypes::CreditRefToCredits,
        ));
    }

    for (base, link_type) in bases {
        let links = get_links(
            LinkQuery::new(base, link_type.try_into_filter()?),
            GetStrategy::Network,
        )?;
        for link in links {
            if ActionHash::try_from(link.target.clone()).ok() == Some(credit_hash.clone()) {
                delete_link(link.create_link_hash, GetOptions::default())?;
            }
        }
    }

    delete_entry(credit_hash)
}

pub fn credit_from_record(record: &Record) -> ExternResult<HumanCredit> {
    record
        .entry()
        .to_app_option()
        .map_err(|e| wasm_error!(e))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
            "Record does not contain a HumanCredit entry"
        ))))
}

/// Build the card-shaped view of a credit.
pub fn build_credit_with_context(
    credit_hash: ActionHash,
    strategy: GetStrategy,
) -> ExternResult<Option<CreditWithContext>> {
    let get_options = match strategy {
        GetStrategy::Local => GetOptions::local(),
        _ => GetOptions::network(),
    };

    let details = match get_details(credit_hash.clone(), get_options)? {
        Some(Details::Record(details)) => details,
        _ => return Ok(None),
    };

    let credit = credit_from_record(&details.record)?;
    let action = details.record.action().clone();
    let author = action.author().clone();
    let timestamp = action.timestamp();

    let deleted_timestamp = details
        .deletes
        .first()
        .map(|delete| delete.action().timestamp());

    Ok(Some(CreditWithContext {
        credit,
        action,
        action_hash: credit_hash,
        author,
        timestamp,
        deleted_timestamp,
    }))
}

#[hdk_extern]
pub fn get_credit_with_context(credit_hash: ActionHash) -> ExternResult<Option<CreditWithContext>> {
    build_credit_with_context(credit_hash, GetStrategy::Local)
}
