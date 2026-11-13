# Human Credit on Holochain

A `credits` zome pair added to a MewsFeed fork, so an acknowledgment of
someone's contribution becomes a peer-validated record instead of a row in a
database you control.

## Why Holochain fits this

Each credit is an entry on the **author's own source chain**, signed by them.

- The recipient cannot write to it, edit it, or remove it. Their track record
  is assembled from other people's signed statements.
- Nobody can forge a credit into your record. Index links are validated to
  require that whoever wrote the link also authored the credit.
- Nobody can credit themselves. Enforced in validation, not just in the UI.
- No gas. Writes cost nothing beyond the author's own storage and bandwidth.
- The acknowledgment does not depend on an NFT still existing. Transfer it,
  burn it, the credit stands.

## Data model

`HumanCredit` (`crates/credit_types/src/lib.rs`):

| Field | Meaning |
|---|---|
| `recipient` | `AgentPubKey` being acknowledged |
| `contribution` | the acknowledgment, in the author's words |
| `credit_ref` | optional `{ collection, token_id, chain }`, e.g. `credits` / `77449` |
| `attached_to` | optional `ActionHash` of a mew this hangs off |

### On `credit_ref` being unverified

Holochain validation is deterministic and has no network access, so a zome
**cannot** check that the author holds the token they cite. `credit_ref` is a
claim by the author and nothing more. This is consistent with the Human Credit
principle that an acknowledgment never implies identity, ownership, or
entitlement to proceeds — but it should be surfaced that way in the UI, not
rendered as a verified badge.

If you later want verification, the options are an oracle agent that signs
attestations after checking the chain off-DHT, or a membrane proof at join
time. Both add a trusted party; neither is in this zome.

## Link indexes

| Link type | Base | Purpose |
|---|---|---|
| `AllCredits` | `all_credits` path | global feed |
| `AuthorToCredits` | author agent key | credits given |
| `RecipientToCredits` | recipient agent key | **credits received — the track record** |
| `MewToCredits` | mew action hash | credits attached to a post |
| `CreditRefToCredits` | `credit_refs.{collection}:{token_id}` path | every credit citing one token |

## Zome API

```
create_credit(CreditInput)              -> Record
get_credit(ActionHash)                  -> Option<Record>
get_credit_with_context(ActionHash)     -> Option<CreditWithContext>
delete_credit(ActionHash)               -> ActionHash
get_credits_for_recipient(AgentPubKey)  -> Vec<CreditWithContext>
get_credits_by_author(AgentPubKey)      -> Vec<CreditWithContext>
get_all_credits(())                     -> Vec<CreditWithContext>
get_credits_for_mew(ActionHash)         -> Vec<CreditWithContext>
get_credits_for_credit_ref(CreditRefQuery) -> Vec<CreditWithContext>
count_credits_for_recipient(AgentPubKey)   -> usize
count_distinct_crediters(AgentPubKey)      -> usize
```

Read functions take the repo's `ZomeFnInput<T>` wrapper: `{ input, local }`,
where `local: false` forces a network get.

`count_distinct_crediters` is the one to use for threshold logic. A raw credit
count can be inflated by a single enthusiastic author; distinct crediters
cannot, without distinct agents.

## Validation rules

In `dnas/mewsfeed/zomes/integrity/credits/`:

1. `recipient != author` — no self-crediting.
2. `contribution` length within `credit_characters_min/max` from DNA properties.
3. Updates always invalid. An acknowledgment is a statement at a point in time;
   editing it would let an author rewrite someone else's record after the fact.
4. Deletes only by the original author, and `delete_credit` removes the index
   links first so counts stay accurate. The delete is still a tombstone — peers
   who hold the original see that it existed and was retracted.
5. Every index link must be authored by the author of the credit it points at,
   and its base must match the credit's own fields.

## Decisions worth revisiting

- **Deletes are allowed.** If the goal is a record that truly cannot be walked
  back, make `validate_delete_credit` always invalid. Retraction would then be
  a new counter-credit rather than a removal.
- **No weighting.** Every credit counts the same. The trustgraph fork of
  MewsFeed carries Trust Atoms, which let a reader weight each author. That is
  the natural next layer and is closer to the mutual-credit direction than a
  flat count.
- **No rate limit.** One agent can write unlimited credits. `count_distinct_crediters`
  blunts this for display, but a per-author cap in validation would be stronger.

## Building

Requires a desktop with Nix. **This cannot be built from an iPhone**, and the
cloud session that wrote it had no crates.io access, so the Rust here is
parse-checked and reviewed but **has not been compiled**. Expect to fix a
signature or two on first build.

```sh
nix develop
npm install
npm run build:happ     # builds zomes to wasm32, packs both DNAs
npm test               # tryorama tests
npm start              # 2-agent local network
```

Things most likely to need a touch-up on first compile, all in the new zome:

- `Component::from(&str)` in `links.rs` — if it does not resolve, use
  `Component::from(s.to_string())`.
- `get_details` returning `Details::Record` in `credit.rs`.
- `LinkQuery::new` accepting `AnyLinkableHash` directly.

Zome order in both `dna.yaml` files is load-bearing: `mews_integrity` must stay
at index 1, because `mews/src/mew.rs` hardcodes `ZomeIndex(1)` when validating
mewmews.

## Not done yet

- No UI. The Vue app in `ui/` has no credits view, no credit button on a mew,
  no credits tab on a profile.
- No tryorama tests for the credits zome.
- Nothing wired to `humancredit.co`. Reaching browser visitors means Holo
  hosting via the `holo-dev-server` and joining-service plumbing kept in place.

## Licensing

MewsFeed ships **no LICENSE file**. Holochain core is CAL-1.0, but that does
not extend to this repo by itself. Before publishing a fork, ask GeekGene what
terms apply — CAL-1.0 in particular has a source-disclosure obligation toward
users that would shape how you ship a hosted version.
