# Eko

The app for the Human Ledger Framework.

Eko is a fork of a Holochain microblogging app, stripped of its original
branding and rebuilt around one question: what does a person's contribution
look like when nobody owns the record of it?

A post is an **echo**. An acknowledgment of someone's contribution is a
**credit**. Credits accumulate into a track record that the subject cannot
edit, and that track record is what eventually backs a line of mutual credit.

## Where Eko sits

### The Five Foundational Layers

Civilizational primitives, not products. Eko reimplements none of them.

| Layer | Answers |
|---|---|
| **Identity and Agency** | Who are you across time and systems? |
| **Memory and Interoperability** | Does what I build carry forward? |
| **Connectivity** | Can people coordinate without a gatekeeper? |
| **Accounting and Value Flow** | Does value follow contribution? |
| **Energy and Physical Infrastructure** | Can digital systems survive in the physical world? |

Together these are the substrate of a GENESIS State. They are what make a
society non-extractive.

### Eko is a living system, not a layer

Eko sits on top of the five, as an organ rather than a primitive. It is the
surface where contribution gets acknowledged and where a GENESIS State
constitutes itself.

| Eko zome | Foundational layer it reaches for |
|---|---|
| `profiles` | Identity and Agency |
| `credits` | Memory and Interoperability. Reputation that travels and does not reset. |
| `genesis` | the GENESIS State itself: charter, membership, commitments |
| ledger (vocabulary only) | Accounting and Value Flow |
| `echoes` | the community surface the rest hangs off |

**Holochain** is the runtime Eko is written against, not one of the five
layers. Every echo, credit, charter and admission is an entry on its author's
own source chain, validated by peers. That is a technical fact about this
codebase rather than a position in the ecosystem.

### What a GENESIS State is

Not a brand. A society where identity persists, effort compounds, reputation
travels, contribution is remembered, value follows humans, infrastructure is
participatory, power is not centralized, and systems evolve without erasing
people.

A GENESIS State can live inside any country. It is a civilization layer, and
the Human Ledger Framework is its blueprint.

Eko's job in that is narrow and concrete: make contribution legible, make
membership provable, and make the record of both something no platform owns.

## Human Credit inside Eko

`humancredit.co` is the public face of the `credits` zome. The web version
keeps a card in a database. The Eko version keeps a signed entry on the
author's own chain, which changes what the record means:

- The recipient has no write access to their own track record. It is assembled
  entirely from statements other people signed.
- Nobody can forge a credit into your record. Every index link is validated to
  require that whoever wrote the link also authored the credit.
- Nobody can credit themselves. Enforced in validation, not in the UI.
- No gas. Writes cost the author's own storage and bandwidth, nothing else.
- The acknowledgment does not depend on an NFT still existing. Transfer it,
  burn it, the credit stands.

### Data model

`HumanCredit` in `crates/credit_types`:

| Field | Meaning |
|---|---|
| `recipient` | agent being acknowledged |
| `contribution` | the acknowledgment, in the author's words |
| `credit_ref` | optional `{ collection, token_id, chain }`, for example `credits` / `77449` |
| `attached_to` | optional echo this hangs off |

**`credit_ref` can never be verified on-DHT.** Holochain validation is
deterministic and has no network access, so a zome cannot check that the author
holds the token they cite. It is a claim by the author and nothing more. That
is consistent with the rule that a credit never implies identity, ownership or
entitlement to proceeds, but the UI should render it as a citation rather than
a verified badge. Verification would need an oracle agent or a membrane proof,
and both introduce a trusted party.

### Zome API

```
create_credit(CreditInput)                 -> Record
get_credit(ActionHash)                     -> Option<Record>
get_credit_with_context(ActionHash)        -> Option<CreditWithContext>
delete_credit(ActionHash)                  -> ActionHash
get_credits_for_recipient(AgentPubKey)     -> Vec<CreditWithContext>
get_credits_by_author(AgentPubKey)         -> Vec<CreditWithContext>
get_all_credits(())                        -> Vec<CreditWithContext>
get_credits_for_echo(ActionHash)           -> Vec<CreditWithContext>
get_credits_for_credit_ref(CreditRefQuery) -> Vec<CreditWithContext>
count_credits_for_recipient(AgentPubKey)   -> usize
count_distinct_crediters(AgentPubKey)      -> usize
get_credit_line(AgentPubKey)               -> CreditLine
```

Read functions take the repo's `ZomeFnInput<T>` wrapper, `{ input, local }`,
where `local: false` forces a network get.

## Mutual credit

`crates/ledger_types` holds the vocabulary and no accounting engine. That is
deliberate.

Mutual credit only works if a balance cannot move without both parties signing
the same action. On Holochain that means countersigning sessions. Writing a
singly-signed balance change would not be mutual credit, it would be
self-issued money. Settlement belongs to the Accounting and Value Flow layer rather
than being hand-rolled here.

What Eko does own is the **credit line**: how far below zero an agent may go.
In mutual credit the limit is the whole design, because it is the community's
statement of how far it trusts this agent to make good. `get_credit_line`
derives it from `count_distinct_crediters`:

```
reputation  ->  credit line  ->  mutual credit
(credits)       (Eko)            (accounting layer)
```

Distinct crediters, not credit count. One enthusiastic author must not be able
to inflate a neighbour's borrowing power. `CREDIT_LINE_PER_CREDITER` and
`CREDIT_LINE_CEILING` in `queries.rs` are placeholders; a community sets these,
they are not constants of nature.

## GENESIS States

The `genesis` zome. Three entries make a state legible.

**Charter.** What the state is: name, purpose, membership rule, decision rule,
credit policy. Immutable. An amendment is a new charter whose `amends` points
at the one it replaces, so the history of a state's rules stays readable. The
founding charter's action hash is the state's identity everywhere else.

**Admission.** That one agent admitted another. Written by the sponsor, never
by the newcomer, and it names `sponsor_admission`: the sponsor's own admission
to the same state.

That one field is the design. Membership becomes a chain any peer can walk
back to the founder, checking every link, because each link is an entry
somebody signed:

```
founder -> admits A -> A admits B -> B admits C
```

Validation enforces each step: you cannot admit yourself, you cannot admit into
a state you are not in, and the admission you cite as your authority must be
yours and must belong to the same state. `get_sponsorship_chain` walks it.

A founder leaves `sponsor_admission` as `None`, which only the charter's author
may do. That is the root of the chain.

**Commitment.** What an agent undertook to do, for whom, by when, inside a
state. It cites the committer's own admission, so a commitment is always
state-scoped and provably made by a member.

Commitment is what gives a credit its provenance. Today a credit appears from
nowhere. Pointed at a commitment via `attached_to`, it says what was promised
as well as what was done, which closes the loop across all three domains:

```
commitment  ->  credit  ->  credit line  ->  mutual credit
(coordination)  (reputation) (Eko)          (accounting layer)
```

### Genesis zome API

```
found_state(CharterInput)              -> Record
admit(AdmissionInput)                  -> Record
make_commitment(CommitmentInput)       -> Record
get_state(ActionHash)                  -> Option<StateSummary>
get_all_states(())                     -> Vec<StateSummary>
get_members(ActionHash)                -> Vec<MemberRecord>
get_states_for_agent(AgentPubKey)      -> Vec<MemberRecord>
get_membership(MembershipQuery)        -> Option<MemberRecord>
get_sponsorship_chain(ActionHash)      -> Vec<MemberRecord>
get_commitments_for_state(ActionHash)  -> Vec<(Commitment, ActionHash)>
get_commitments_for_agent(AgentPubKey) -> Vec<(Commitment, ActionHash)>
```

### What this is not, yet

**A charter in this DNA is a declared state, not a sovereign one.** Everyone on
Eko's DHT can read every state, and the rules enforced are Eko's validation
rules, not the state's own. That is the honest limit of the current design.

Real sovereignty on Holochain means a state gets **its own DNA and its own
DHT**: a distinct network seed, its own membrane, its own validation. The
mechanism is cloned cells. The structural path is a second role in
`happ.yaml`, provisioned deferred with a clone limit above zero, pointing at a
`genesis` DNA that is cloned once per state, carrying the charter in its DNA
properties so the rules are baked into the network rather than stored in it.

That is the right destination and it is deliberately not built yet. Getting the
single-DNA version working and tested first is cheaper than debugging
membranes and clone management before the primitives are proven.

Two rules are also declared but **not enforced by peers**:

- `MembershipRule::CreditThreshold` needs `genesis_integrity` to depend on
  `credits_integrity` so it can deserialize credits and count distinct authors.
- `DecisionRule` is recorded and nothing checks it. Charter amendment is
  currently founder-only, whatever the charter says.

Both are marked in the source. Do not ship a state whose safety depends on
either until they are real.

## Messaging and calls

Eko can carry private conversations and live calls between its members. The
`messages` zome does the work, and it is built differently from the feed on
purpose.

### What it does

- **Direct messages** between two people, and **small groups** of 3 to 12.
- **Calls** over WebRTC: video, audio only, or a broadcast where one person
  sends and the rest watch. A group can call as a mesh (everyone to everyone),
  which is comfortable for about four to six people.
- Messages from someone you have not accepted arrive as a request.

### How it is built

Messages never touch the shared DHT. The sender writes the message to their own
chain, then hands it straight to each member with a direct call. Each member
keeps their own copy as a private entry on their own chain. So there is no
public record of who talked to whom, and no server in the middle.

If a member is offline, the message stays marked pending on the sender's side
and is retried when the app starts and every 30 seconds after. A delivery
receipt is written for each member who confirms, so a retry never duplicates.

A call is a WebRTC connection between phones. Holochain only carries the
handshake (offer, answer, network candidates) as ephemeral remote signals.
Nothing about a call is written to any chain.

### Zome API (`messages`)

| Function | Purpose |
| --- | --- |
| `get_my_conversations` | Every conversation I hold, newest first |
| `open_direct(agent)` | Open or create the conversation with one person |
| `create_group({title, members, first_message})` | Start a group; members are fixed |
| `accept_conversation(key)` | Accept a request |
| `get_messages(key)` | A thread, oldest first, with who each message is still waiting on |
| `send_message({conversation_key, body, reply_to})` | Write and deliver |
| `retry_pending()` | Retry everything undelivered |
| `receive_message(wire)` | Called by other agents to hand me a message |
| `send_call_signal(...)` / `recv_remote_signal` | Call handshake |

### Honest limits

- **Delivery needs both sides to be online at some point.** An offline member
  gets the message only after the sender comes back online and retries. There
  is no relay holding messages in between. A relay or backup peer would fix
  this and is the natural next step.
- **No history on a new device.** Messages live on the devices that received
  them. A new device starts empty.
- **Anyone can send you a message request.** There is no blocking yet. A
  stranger can add entries to your private chain until blocking and a
  per-sender limit exist.
- **Group membership is set when the group is created.** Add or remove people
  by starting a new group. Each member trusts the list they were sent.
- **Calls need NAT help.** The default is a public STUN server, which tells its
  operator your IP address. Some networks block direct connections and need a
  TURN relay. Set `VITE_ICE_SERVERS` to a JSON list of your own servers.
- **Mesh calls do not scale.** Past about six people the video load on each
  phone becomes too much. A broadcast helps because only the host uploads, but
  a host with many viewers still needs the bandwidth.
- **Messages are not end-to-end encrypted by Eko itself.** They travel over
  Holochain's encrypted connections between peers and rest unencrypted on each
  person's own chain. That is private from the network, not from someone who
  has your device.
- **Not yet verified end to end.** The tests cover delivery, requests, groups,
  offline pending and signal arrival. A real two-device video call has not
  been tried.

### Where it came from

The shape borrows from two Holochain apps. Presence (darksoil studio) uses
WebRTC with signaling carried over Holochain. Volla Messages keeps each
conversation in its own small network. Eko keeps messages inside one network
but stores them privately and peer to peer. Moving each conversation to its own
cloned network, as Volla does, would also hide the fact that a conversation
exists and is the stronger design. It was left out of this first version
because it changes the app's structure.

Loop (loopis.live) is a live-events platform: hosting, registration, replays.
Eko's broadcast mode covers the "host speaks, others watch" part. Scheduling,
registration and replays are not built.

## Validation rules in `credits`

1. `recipient != author`. No self-crediting.
2. `contribution` length within `credit_characters_min/max` from DNA properties.
3. Updates always invalid. An acknowledgment is a statement at a point in time;
   editing it would let an author rewrite someone else's record after the fact.
4. Deletes only by the original author, and `delete_credit` removes index links
   first so counts stay accurate. The delete is still a tombstone: peers who
   hold the original see that it existed and was retracted.
5. Every index link must be authored by the author of the credit it points at,
   and its base must match the credit's own fields.

## Decisions worth revisiting

- **Deletes are allowed.** For a record that genuinely cannot be walked back,
  make `validate_delete_credit` always invalid and let retraction be a
  counter-credit instead of a removal.
- **No weighting.** Every credit counts the same. Weighting each author by how
  much a reader trusts them is the natural next layer, and is closer to mutual
  credit than a flat count.
- **No rate limit.** One agent can write unlimited credits.
  `count_distinct_crediters` blunts this for display, but a per-author cap in
  validation would be stronger.

## Building

Requires a desktop with Nix. This cannot be built from a phone. The session
that wrote the `credits` zome and the rename had no crates.io access, so the
new Rust is parse-checked and reviewed but **has not been compiled**. Expect to
fix a signature or two on first build.

```sh
nix develop
npm install
npm run build:happ     # builds zomes to wasm32, packs both DNAs
npm test               # tryorama tests
npm start              # 2-agent local network
```

Most likely to need a touch-up, all in the new zome:

- `Component::from(&str)` in `credits/src/links.rs`. If it does not resolve,
  use `Component::from(s.to_string())`.
- `get_details` returning `Details::Record` in `credits/src/credit.rs`.
- `LinkQuery::new` accepting `AnyLinkableHash` directly.
- The generic `load::<T>` helper in `genesis/src/queries.rs`, whose
  `TryFrom<SerializedBytes>` bound may need to be an `AppEntry` bound instead.

Zome order in both `dna.yaml` files is load-bearing. `echoes_integrity` must
stay at index 1, because `echoes/src/echo.rs` hardcodes `ZomeIndex(1)` when
validating reechoes. New integrity zomes get appended at the end, never
inserted above it. Current order: `profiles_integrity`, `echoes_integrity`,
`credits_integrity`, `genesis_integrity`.

## Not done yet

- No UI for GENESIS States. No charter form, roster, or commitment list.
- Messaging and calls are new and unverified between real devices. See the
  honest limits in "Messaging and calls".
- GENESIS States are declared, not sovereign. See the cloned-cell note above.
- Nothing wired to `humancredit.co`. Reaching browser visitors means Holo
  hosting, which the `holo-dev-server` and joining-service plumbing supports.

## Provenance and licensing

Eko is a fork of GeekGene's MewsFeed. The upstream repo ships **no LICENSE
file**. Holochain core is CAL-1.0, but that does not extend to the fork by
itself. Settle terms with GeekGene before publishing. CAL-1.0 in particular
carries a source-disclosure obligation toward users, which would shape how a
hosted version ships.

The rename to Eko was mechanical across roughly 5,500 occurrences. Upstream
fixes can still be pulled, but every merge will conflict on naming. Keeping a
`upstream-tracking` branch at the original naming, and rebasing the rename on
top, is the cheaper long-term arrangement.
