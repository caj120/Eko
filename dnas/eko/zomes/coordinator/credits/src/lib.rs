pub mod credit;
pub mod queries;

pub use credit::*;
pub use credit_types::*;
use hdk::prelude::*;
pub use queries::*;

#[hdk_extern]
pub fn init() -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}
