# Eko

The app for the Human Ledger Framework.

A post is an **echo**. An acknowledgment of someone's contribution is a
**credit**. Credits build a track record the subject cannot edit, and that
record is what eventually backs a line of mutual credit.

Built on Holochain, so every entry lives on its author's own source chain and
is validated by peers rather than held by a server.

See [EKO.md](./EKO.md) for the architecture, the Human Credit data model and
the mutual-credit plan.

Forked from [GeekGene/MewsFeed](https://github.com/GeekGene/MewsFeed).
See the provenance and licensing note in EKO.md before publishing.

## Environment Setup

1. Install the holochain dev environment (only nix-shell is required): https://developer.holochain.org/docs/install/
2. Enable Holochain cachix with:

```bash
nix-env -iA cachix -f https://cachix.org/api/v1/install
cachix use holochain-ci
```

3. Clone this repo and `cd` inside of it.
4. Enter the nix shell by running this in the root folder of the repository:

```bash
nix develop
npm install
```

This will install all the needed dependencies in your local environment, including `holochain`, `hc` and `npm`.

## Building the DNA

- Build the DNA (assumes you are still in the nix shell for correct rust/cargo versions from step above):

```bash
npm run build:happ
```

## Running the DNA tests

```bash
npm run test
```

## UI

To test out the UI:

```bash
npm start
```

To run another agent, open another terminal, and execute again:

```bash
npm start
```

Each new agent that you create this way will get assigned its own port and get connected to the other agents.

## Local HWC Development

The `deploy/local-dev.sh` script manages local infrastructure for testing with the Holo Web Conductor browser extension. It starts conductors, a bootstrap server, the h2hc-linker, and optionally a joining service.

### Prerequisites

- Nix develop shell (`nix develop`)
- Sibling repo checkouts (see layout below)
- [h2hc-linker](https://github.com/holo-host/h2hc-linker) built at `../h2hc-linker` (or set `H2HC_LINKER_DIR`)
- [joining-service](https://github.com/holo-host/joining-service) at `../joining-service` (or set `JOINING_SERVICE_DIR`) — only needed for joining mode
- The HWC browser extension installed

### First-time setup

All HWC-related repos must be siblings in the same parent directory:

```
parent/
├── eko/               # This repo
├── holo-web-conductor/     # Required (provides client library)
├── joining-service/        # Optional (for joining mode)
└── h2hc-linker/            # Required (linker binary)
```

Run the setup script from holo-web-conductor to verify the layout and build dependencies:

```bash
cd ../holo-web-conductor
nix develop -c ./scripts/holo-dev-setup.sh
```

Use `--clone` to automatically clone missing repos, or `--download-linker` to fetch a prebuilt linker binary instead of building from source.

Then install this repo's dependencies:

```bash
cd ../eko
nix develop -c npm install
```

### Quick Start

**Basic mode** (no joining service, direct linker connection):

```bash
npm run start:hwc
```

**With joining service** (invite code auth, default):

```bash
npm run start:hwc:joining
```

**With email code auth** (verification codes written to files):

```bash
AUTH_METHOD=email_code npm run start:hwc:joining
```

Email codes are written to `/tmp/eko-local-dev/dev-emails/`. Read the file to get the verification code.

**With email code + hc_auth integration**:

```bash
AUTH_METHOD=email_code \
HC_AUTH_URL=https://hc-auth-server.example.com \
HC_AUTH_TOKEN=your-api-token \
npm run start:hwc:joining
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AUTH_METHOD` | `invite_code` | Auth method: `invite_code`, `email_code`, `open` |
| `INVITE_CODES` | `test-invite-123` | Comma-separated invite codes (for `invite_code` method) |
| `EMAIL_OUTPUT_DIR` | `/tmp/eko-local-dev/dev-emails` | Directory for email-to-file dev emails |
| `HC_AUTH_URL` | _(empty)_ | hc_auth server URL (enables hc_auth notification on join) |
| `HC_AUTH_TOKEN` | _(empty)_ | hc_auth API bearer token |
| `HC_AUTH_FORWARD_CLAIMS` | _(empty)_ | Comma-separated claim keys to forward to hc_auth (e.g. `email,phone`) |
| `JOINING_SERVICE_DIR` | `../joining-service` | Path to joining-service repo |
| `H2HC_LINKER_DIR` | `../h2hc-linker` | Path to h2hc-linker repo |
| `JOINING_SERVICE_PORT` | `3000` | Joining service port |
| `LINKER_PORT` | `8000` | Linker port |
| `NUM_CONDUCTORS` | `2` | Number of holochain conductors to start |
| `LINKER_ADMIN_SECRET` | `local-dev-secret` | Linker admin secret |

### Managing Services

```bash
./deploy/local-dev.sh status    # Show running services
./deploy/local-dev.sh stop      # Stop all services
```

## Holo Web Conductor Deployment

For deploying eko with the Holo Web Conductor (HWC) browser extension, see [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Package

To package the web happ:

```bash
npm run package
```

You'll have the `eko.webhapp` in `workdir`. This is what you should distribute so that the Holochain Launcher can install it.

You will also have its subcomponent `eko.happ` in the same folder`.

## Documentation

We are using this tooling:

- [NPM Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/): npm v7's built-in monorepo capabilities.
- [hc](https://github.com/holochain/holochain/tree/develop/crates/hc): Holochain CLI to easily manage Holochain development instances.
- [@holochain/tryorama](https://www.npmjs.com/package/@holochain/tryorama): test fraechoork.
- [@holochain/conductor-api](https://www.npmjs.com/package/@holochain/conductor-api): client library to connect to Holochain from the UI.
