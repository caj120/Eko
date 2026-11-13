# Eko

The app for the Human Ledger Framework.

Eko is a fork of a Holochain microblogging app, stripped of its original
branding and rebuilt around one question: what does a person's contribution
look like when nobody owns the record of it?

A post is an **echo**. An acknowledgment of someone's contribution is a
**credit**. Credits accumulate into a track record that the subject cannot
edit, and that track record is what eventually backs a line of mutual credit.

## The stack

### Foundational 5

The infrastructure layer. Eko does not reimplement any of it.

| | Role in Eko |
|---|---|
| **Holochain** | agent-centric storage and peer validation. Every echo and credit is an entry on its author's own source chain. |
| mutual-credit currencies. The intended settlement engine for the ledger layer. |
| cross-system identity and data portability, so an Eko record is not stranded in one app. |
| energy coordination. The first real-world resource a Genesis State has to account for. |
| connectivity that the community owns rather than rents. |
| asset backing, for the point where mutual credit meets something outside the network. |

### Capability layer (the Eko zomes)

| Capability | Zome | State |
|---|---|---|
| Identity | `profiles` | working |
| Community | `echoes` | working |
| Reputation | `credits` | working, new |
| Data and trust | Holochain validation itself | inherent |
| Coordination | not yet written | planned |

### Domains

Three surfaces the capabilities feed:

- **Livelihood**: the ledger layer. Mutual credit, backed by reputation.
- **Belonging**: profiles and credits. Who you are, and who says so.
- **Culture**: echoes. What a community talks about and amplifies.

### Destination

**Genesis States**: communities that run their own identity, reputation,
currency and coordination without renting any of it. Everything below is the
substrate for that, not a product in itself.

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
self-issued money. The settlement engine belongs to the accounting layer
rather than being hand-rolled here.

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

Zome order in both `dna.yaml` files is load-bearing. `echoes_integrity` must
stay at index 1, because `echoes/src/echo.rs` hardcodes `ZomeIndex(1)` when
validating reechoes.

## Not done yet

- No UI for credits. The Vue app has no credits view, no credit button on an
  echo, no credits tab on a profile.
- No tryorama tests for the `credits` zome.
- No `coordination` zome, so no Genesis State primitives yet.
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
