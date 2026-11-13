pub mod credit;
pub mod dna_properties;
pub mod links;

pub use credit::*;
pub use credit_types::*;
pub use dna_properties::*;
use hdi::prelude::*;
pub use links::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    HumanCredit(HumanCredit),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    /// Global feed of every credit.
    AllCredits,
    /// Credits an agent has given.
    AuthorToCredits,
    /// Credits an agent has received. This is the track record.
    RecipientToCredits,
    /// Credits attached to a specific mew.
    MewToCredits,
    /// Credits citing one external token.
    CreditRefToCredits,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

fn validate_create_link(
    link_type: LinkTypes,
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    match link_type {
        LinkTypes::AllCredits => {
            validate_create_link_all_credits(action, base_address, target_address, tag)
        }
        LinkTypes::AuthorToCredits => {
            validate_create_link_author_to_credits(action, base_address, target_address, tag)
        }
        LinkTypes::RecipientToCredits => {
            validate_create_link_recipient_to_credits(action, base_address, target_address, tag)
        }
        LinkTypes::MewToCredits => {
            validate_create_link_mew_to_credits(action, base_address, target_address, tag)
        }
        LinkTypes::CreditRefToCredits => {
            validate_create_link_credit_ref_to_credits(action, base_address, target_address, tag)
        }
    }
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::HumanCredit(credit) => {
                    validate_create_credit(EntryCreationAction::Create(action), credit)
                }
            },
            OpEntry::UpdateEntry {
                app_entry, action, ..
            } => match app_entry {
                EntryTypes::HumanCredit(credit) => {
                    validate_create_credit(EntryCreationAction::Update(action), credit)
                }
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterUpdate(update_entry) => match update_entry {
            OpUpdate::Entry { app_entry, action } => match app_entry {
                EntryTypes::HumanCredit(credit) => validate_update_credit(action, credit),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDelete(OpDelete { action }) => {
            let original_action = must_get_action(action.deletes_address.clone())?
                .hashed
                .content;
            validate_delete_credit(action, original_action)
        }

        FlatOp::RegisterCreateLink {
            link_type,
            base_address,
            target_address,
            tag,
            action,
        } => validate_create_link(link_type, action, base_address, target_address, tag),

        FlatOp::RegisterDeleteLink {
            original_action,
            action,
            ..
        } => validate_delete_credit_link(action, original_action),

        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => match app_entry {
                EntryTypes::HumanCredit(credit) => {
                    validate_create_credit(EntryCreationAction::Create(action), credit)
                }
            },
            OpRecord::UpdateEntry {
                app_entry, action, ..
            } => match app_entry {
                EntryTypes::HumanCredit(credit) => validate_update_credit(action, credit),
            },
            OpRecord::DeleteEntry {
                original_action_hash,
                action,
                ..
            } => {
                let original_action = must_get_action(original_action_hash)?.hashed.content;
                validate_delete_credit(action, original_action)
            }
            OpRecord::CreateLink {
                base_address,
                target_address,
                tag,
                link_type,
                action,
            } => validate_create_link(link_type, action, base_address, target_address, tag),
            OpRecord::DeleteLink {
                original_action_hash,
                action,
                ..
            } => {
                let record = must_get_valid_record(original_action_hash)?;
                match record.action() {
                    Action::CreateLink(create_link) => {
                        validate_delete_credit_link(action, create_link.clone())
                    }
                    _ => Ok(ValidateCallbackResult::Invalid(
                        "The action that a DeleteLink deletes must be a CreateLink".to_string(),
                    )),
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterAgentActivity(_) => Ok(ValidateCallbackResult::Valid),
    }
}
