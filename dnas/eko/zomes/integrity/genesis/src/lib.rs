pub mod entries;
pub mod links;

pub use entries::*;
pub use genesis_types::*;
use hdi::prelude::*;
pub use links::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    Charter(Charter),
    Admission(Admission),
    Commitment(Commitment),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllStates,
    StateToMembers,
    MemberToStates,
    StateToCommitments,
    AgentToCommitments,
    CharterToAmendments,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

fn validate_entry_creation(
    action: EntryCreationAction,
    app_entry: EntryTypes,
) -> ExternResult<ValidateCallbackResult> {
    match app_entry {
        EntryTypes::Charter(charter) => validate_create_charter(action, charter),
        EntryTypes::Admission(admission) => validate_create_admission(action, admission),
        EntryTypes::Commitment(commitment) => validate_create_commitment(action, commitment),
    }
}

fn kind_of(app_entry: &EntryTypes) -> &'static str {
    match app_entry {
        EntryTypes::Charter(_) => "charter",
        EntryTypes::Admission(_) => "admission",
        EntryTypes::Commitment(_) => "commitment",
    }
}

fn validate_link_creation(
    link_type: LinkTypes,
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
    match link_type {
        LinkTypes::AllStates => {
            validate_create_link_all_states(action, base_address, target_address)
        }
        LinkTypes::StateToMembers => {
            validate_create_link_state_to_members(action, base_address, target_address)
        }
        LinkTypes::MemberToStates => {
            validate_create_link_member_to_states(action, base_address, target_address)
        }
        LinkTypes::StateToCommitments => {
            validate_create_link_state_to_commitments(action, base_address, target_address)
        }
        LinkTypes::AgentToCommitments => {
            validate_create_link_agent_to_commitments(action, base_address, target_address)
        }
        LinkTypes::CharterToAmendments => {
            validate_create_link_charter_to_amendments(action, base_address, target_address)
        }
    }
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, action } => {
                validate_entry_creation(EntryCreationAction::Create(action), app_entry)
            }
            OpEntry::UpdateEntry { app_entry, .. } => validate_no_updates(kind_of(&app_entry)),
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterUpdate(update_entry) => match update_entry {
            OpUpdate::Entry { app_entry, .. } => validate_no_updates(kind_of(&app_entry)),
            _ => Ok(ValidateCallbackResult::Valid),
        },

        FlatOp::RegisterDelete(OpDelete { action }) => {
            let original_action = must_get_action(action.deletes_address.clone())?
                .hashed
                .content;
            validate_author_only_delete(action, original_action, "record")
        }

        FlatOp::RegisterCreateLink {
            link_type,
            base_address,
            target_address,
            action,
            ..
        } => validate_link_creation(link_type, action, base_address, target_address),

        FlatOp::RegisterDeleteLink {
            original_action,
            action,
            ..
        } => validate_delete_genesis_link(action, original_action),

        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::CreateEntry { app_entry, action } => {
                validate_entry_creation(EntryCreationAction::Create(action), app_entry)
            }
            OpRecord::UpdateEntry { app_entry, .. } => validate_no_updates(kind_of(&app_entry)),
            OpRecord::DeleteEntry {
                original_action_hash,
                action,
                ..
            } => {
                let original_action = must_get_action(original_action_hash)?.hashed.content;
                validate_author_only_delete(action, original_action, "record")
            }
            OpRecord::CreateLink {
                base_address,
                target_address,
                link_type,
                action,
                ..
            } => validate_link_creation(link_type, action, base_address, target_address),
            OpRecord::DeleteLink {
                original_action_hash,
                action,
                ..
            } => {
                let record = must_get_valid_record(original_action_hash)?;
                match record.action() {
                    Action::CreateLink(create_link) => {
                        validate_delete_genesis_link(action, create_link.clone())
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
