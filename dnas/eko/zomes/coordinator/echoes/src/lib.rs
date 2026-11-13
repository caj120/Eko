use hdk::prelude::*;
pub mod agent_echoes;
pub mod agent_to_notifications;
pub mod all_echoes;
pub mod cashtag_to_echoes;
pub mod echo;
pub mod echo_to_responses;
pub mod echo_with_context;
pub mod followed_creators_echoes;
pub mod follower_to_creators;
pub mod hashtag_to_echoes;
pub mod liker_to_echoes;
pub mod liker_to_hashes;
pub mod mention_to_echoes;
pub mod pinner_to_echoes;
pub mod pinner_to_hashes;
pub mod random_echoes;
pub mod search_tags;
pub mod tag_to_echoes;

#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
    Ok(InitCallbackResult::Pass)
}

#[hdk_extern]
pub fn ping(_: ()) -> ExternResult<()> {
    Ok(())
}
