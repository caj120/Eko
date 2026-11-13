use genesis_integrity::*;
use hc_zome_input::ZomeFnInput;
use hdk::prelude::*;

fn targets_at(
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

fn options_for(strategy: GetStrategy) -> GetOptions {
    match strategy {
        GetStrategy::Local => GetOptions::local(),
        _ => GetOptions::network(),
    }
}

fn load<T>(hash: ActionHash, strategy: GetStrategy) -> Option<(T, Action, ActionHash)>
where
    T: TryFrom<SerializedBytes, Error = SerializedBytesError>,
{
    let record = get(hash.clone(), options_for(strategy)).ok().flatten()?;
    let action = record.action().clone();
    let entry: T = record.entry().to_app_option().ok().flatten()?;

    Some((entry, action, hash))
}

#[hdk_extern]
pub fn get_state(input: ZomeFnInput<ActionHash>) -> ExternResult<Option<StateSummary>> {
    let strategy = input.get_strategy();
    let Some((charter, action, charter_hash)) = load::<Charter>(input.input.clone(), strategy)
    else {
        return Ok(None);
    };

    let member_count = targets_at(
        charter_hash.clone().into(),
        LinkTypes::StateToMembers,
        strategy,
    )?
    .len();

    Ok(Some(StateSummary {
        charter,
        charter_hash,
        founder: action.author().clone(),
        founded_at: action.timestamp(),
        member_count,
    }))
}

#[hdk_extern]
pub fn get_all_states(input: ZomeFnInput<()>) -> ExternResult<Vec<StateSummary>> {
    let strategy = input.get_strategy();
    let hashes = targets_at(
        Path::from(ALL_STATES_PATH).path_entry_hash()?.into(),
        LinkTypes::AllStates,
        strategy,
    )?;

    let mut states: Vec<StateSummary> = hashes
        .into_iter()
        .filter_map(|hash| {
            get_state(ZomeFnInput::new(hash, Some(strategy == GetStrategy::Local)))
                .ok()
                .flatten()
        })
        .collect();
    states.sort_by_key(|state| std::cmp::Reverse(state.founded_at));

    Ok(states)
}

fn member_records(
    hashes: Vec<ActionHash>,
    strategy: GetStrategy,
) -> ExternResult<Vec<MemberRecord>> {
    Ok(hashes
        .into_iter()
        .filter_map(|hash| {
            let (admission, action, admission_hash) = load::<Admission>(hash, strategy)?;
            Some(MemberRecord {
                admission,
                admission_hash,
                sponsor: action.author().clone(),
                admitted_at: action.timestamp(),
            })
        })
        .collect())
}

/// The roster of a state.
#[hdk_extern]
pub fn get_members(input: ZomeFnInput<ActionHash>) -> ExternResult<Vec<MemberRecord>> {
    let strategy = input.get_strategy();
    let hashes = targets_at(
        input.input.clone().into(),
        LinkTypes::StateToMembers,
        strategy,
    )?;

    member_records(hashes, strategy)
}

/// The states an agent belongs to.
#[hdk_extern]
pub fn get_states_for_agent(input: ZomeFnInput<AgentPubKey>) -> ExternResult<Vec<MemberRecord>> {
    let strategy = input.get_strategy();
    let hashes = targets_at(
        input.input.clone().into(),
        LinkTypes::MemberToStates,
        strategy,
    )?;

    member_records(hashes, strategy)
}

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct MembershipQuery {
    pub state: ActionHash,
    pub agent: AgentPubKey,
}

/// Does this agent belong to this state, and by whose sponsorship?
#[hdk_extern]
pub fn get_membership(input: ZomeFnInput<MembershipQuery>) -> ExternResult<Option<MemberRecord>> {
    let strategy = input.get_strategy();
    let hashes = targets_at(
        input.input.agent.clone().into(),
        LinkTypes::MemberToStates,
        strategy,
    )?;

    Ok(member_records(hashes, strategy)?
        .into_iter()
        .find(|record| record.admission.state == input.input.state))
}

/// Walk an admission back to the founder.
///
/// Returns the sponsorship chain, newest first, ending at the founder's own
/// admission. This is the thing a peer can check: every link in the chain is
/// an entry somebody signed.
#[hdk_extern]
pub fn get_sponsorship_chain(input: ZomeFnInput<ActionHash>) -> ExternResult<Vec<MemberRecord>> {
    let strategy = input.get_strategy();
    let mut chain: Vec<MemberRecord> = Vec::new();
    let mut next = Some(input.input.clone());

    // Bounded so a malformed chain cannot spin forever.
    for _ in 0..256 {
        let Some(hash) = next.take() else { break };
        let Some((admission, action, admission_hash)) = load::<Admission>(hash, strategy) else {
            break;
        };

        next = admission.sponsor_admission.clone();
        chain.push(MemberRecord {
            admission,
            admission_hash,
            sponsor: action.author().clone(),
            admitted_at: action.timestamp(),
        });
    }

    Ok(chain)
}

fn commitments_at(
    base: AnyLinkableHash,
    link_type: LinkTypes,
    strategy: GetStrategy,
) -> ExternResult<Vec<(Commitment, ActionHash)>> {
    Ok(targets_at(base, link_type, strategy)?
        .into_iter()
        .filter_map(|hash| {
            let (commitment, _, commitment_hash) = load::<Commitment>(hash, strategy)?;
            Some((commitment, commitment_hash))
        })
        .collect())
}

#[hdk_extern]
pub fn get_commitments_for_state(
    input: ZomeFnInput<ActionHash>,
) -> ExternResult<Vec<(Commitment, ActionHash)>> {
    let strategy = input.get_strategy();
    commitments_at(
        input.input.clone().into(),
        LinkTypes::StateToCommitments,
        strategy,
    )
}

#[hdk_extern]
pub fn get_commitments_for_agent(
    input: ZomeFnInput<AgentPubKey>,
) -> ExternResult<Vec<(Commitment, ActionHash)>> {
    let strategy = input.get_strategy();
    commitments_at(
        input.input.clone().into(),
        LinkTypes::AgentToCommitments,
        strategy,
    )
}
