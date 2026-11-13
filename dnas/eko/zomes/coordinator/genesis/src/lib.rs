pub mod queries;
pub mod writes;

pub use genesis_types::*;
use hdk::prelude::*;
pub use queries::*;
pub use writes::*;

#[hdk_extern]
pub fn init() -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}
