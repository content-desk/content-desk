# ContentDesk

[简体中文](README.md) | **English**

ContentDesk is a local-first, AI-assisted creation workspace for individual creators, one-person businesses, and small content teams.

> **Current status: Desktop v0.1 is runnable, but not production-ready.** The Electron app now provides local conversations, Provider configuration, SQLite persistence, and read-only Agent Runtime probing. The Project and Workspace Files content workflow has not been implemented yet.

## Current capabilities

| Status | Capability | Details |
| --- | --- | --- |
| Runnable | Electron Desktop v0.1 | Native Chat, persisted conversations, Provider settings, Runtime discovery, and fixed `--version` probes |
| Runnable | OpenAI Compatible | Streaming text chat, stop, retry, and connection testing |
| Runnable | Anthropic Compatible | Streaming text chat, stop, retry, and connection testing |
| Schema only | Azure OpenAI, Vertex AI, Amazon Bedrock | Non-secret configuration can be saved, but these kinds cannot enter Chat and have no fake implementation or fallback |
| Runnable foundation | Web and Server | Hono, oRPC, OpenAPI, Better Auth, and the PostgreSQL authentication data plane |
| Prototype/template | Native, Extension, Fumadocs | Not part of a usable ContentDesk content workflow yet |
| Planned | Project source of truth | Project, Source, Document, Storyboard, Asset, Publication, Metric, and Insight are not implemented |

Automated Provider tests use a local mock server. They do not demonstrate connectivity to OpenAI, Anthropic, Azure, Vertex, Bedrock, or any other real cloud service.

## Product direction

- **Local-first:** Desktop content data and configuration should remain on the user's device by default.
- **Projects are the source of truth:** projects and their files will own durable content context; Chat is only one interface.
- **Replaceable AI:** Provider and Runtime boundaries are explicit, and basic content management should not depend on one AI service.
- **Grow in working layers:** complete a small end-to-end scope before expanding the content model or production surface.

The target lifecycle is:

```text
Signal → Source → Document → Storyboard → Shot → Asset
                                           ↓
                       Publication → Metric → Insight
```

This remains a product direction, not a statement of current functionality. Desktop v0.1 currently implements only the local Chat foundation.

## Architecture and data boundaries

Desktop and Server use separate data planes:

```text
Electron Renderer
      │ typed IPC
Electron Preload
      │
Electron Main ── node:sqlite ── Desktop SQLite
      │
      ├── safeStorage ── encrypted Provider secrets
      └── AI SDK ── configured third-party Provider

Web / Native ── HTTP / oRPC / Better Auth ── Hono Server ── PostgreSQL
```

- Desktop SQLite stores conversations, messages, non-secret Provider configuration, and Runtime profiles.
- API keys and custom-header values are encrypted with Electron `safeStorage`; SQLite stores only references and non-sensitive metadata.
- Desktop does not yet provide Projects, Workspace Files, cloud sync, export, or backup.
- Provider requests originate in Main. Renderer has no direct access to Node, SQLite, secrets, or Provider networking.
- Server PostgreSQL currently stores Better Auth data and does not share a schema with Desktop SQLite.
- Remote Provider Base URLs must use HTTPS; HTTP is allowed only for loopback addresses.

“Local-first” does not mean that all data always stays on-device: when Chat is used, user input and required context are sent to the third-party Provider configured by the user.

## Repository structure

```text
apps/
├── desktop/      Electron Main, Preload, Renderer, SQLite, and tests
├── web/          React + TanStack Router Web/PWA foundation
├── server/       Hono, oRPC/OpenAPI, and Better Auth
├── native/       Expo / React Native prototype
├── extension/    Placeholder WXT browser extension
└── fumadocs/     Template Fumadocs documentation site
packages/
├── api/          Shared oRPC context, procedures, and router
├── auth/         Better Auth configuration
├── db/           Drizzle/PostgreSQL authentication data plane
├── env/          Environment validation
├── ui/           Shared React UI and styles
└── config/       Shared TypeScript configuration
```

The root uses a pnpm workspace and Turborepo. The Desktop SQLite and Server PostgreSQL boundary is recorded in [ADR-0001](docs/adr/0001-desktop-bootstrap-v0.1.md).

## Quick start

### Requirements

- Node.js 24. Electron 43 embeds Node 24.17 and uses `node:sqlite`.
- pnpm `11.21.0`, pinned in the root `package.json`.
- macOS is the verified Desktop v0.1 platform.

### Start Desktop

```bash
pnpm install
pnpm run dev:desktop
```

Desktop starts without Server or PostgreSQL. On first launch it creates a SQLite database under Electron `userData`; encrypted Provider secrets are stored under the same application data directory.

To use Chat, configure an OpenAI Compatible or Anthropic Compatible Provider in Settings. Never commit API keys, `.env` files, SQLite databases, or runtime state.

### Optional: start Web and Server

The Web/Server authentication path requires PostgreSQL plus `apps/server/.env` and `apps/web/.env`:

```bash
pnpm run db:start
pnpm run db:push
pnpm run dev:server
pnpm run dev:web
```

Web defaults to `http://localhost:3001`; Server defaults to `http://localhost:3000`.

## AI Providers and Runtimes

| Type | v0.1 status | Secret storage | Available to Native Chat |
| --- | --- | --- | --- |
| OpenAI Compatible | Implemented | `safeStorage` | Yes |
| Anthropic Compatible | Implemented | `safeStorage` | Yes |
| Azure OpenAI | Schema only | Can be stored | No |
| Vertex AI | Schema only | Can be stored | No |
| Amazon Bedrock | Schema only | Can be stored | No |

ContentDesk Native is the only Chat Runtime. Codex and Claude Code profiles are limited to executable discovery, manual selection, and a fixed `--version` probe. They do not take over authentication, read global auth configuration, or execute arbitrary commands.

## Development and verification commands

Run these commands from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm run dev:desktop` | Start Electron Desktop in development mode |
| `pnpm --filter @content-desk/desktop check` | Check Desktop source and tests |
| `pnpm --filter @content-desk/desktop check-types` | Type-check Desktop |
| `pnpm --filter @content-desk/desktop test` | Run Desktop unit, integration, and Renderer tests |
| `pnpm --filter @content-desk/desktop test:e2e` | Build and run Electron E2E with a local mock Provider |
| `pnpm --filter @content-desk/desktop package` | Build an unsigned macOS directory artifact |
| `pnpm run check` | Run repository-wide Ultracite/Biome checks |
| `pnpm run check-types` | Type-check workspaces through Turborepo |
| `pnpm turbo run test --force` | Test workspaces that define a `test` task |
| `pnpm run build` | Build all workspaces that define a `build` task |

See the [Desktop README](apps/desktop/README.md) and [acceptance report](docs/engineering/desktop-bootstrap-v0.1-acceptance.md) for local acceptance steps, the legacy database policy, and known limitations.

## Roadmap

1. Establish a local Project model and user-controlled Workspace Files as the source of truth.
2. Complete a non-AI `Project → Document/Script → Storyboard → Asset` workflow.
3. Turn Desktop Chat into an interface over Projects rather than an isolated conversation product.
4. Upgrade Extension and Native from templates into capture and review entry points.
5. After the content model is stable, expand generation, publishing, reuse, and performance review.

## License

ContentDesk is distributed under the repository's [ContentDesk License](LICENSE), with [NOTICE](NOTICE). It is a custom source-available license containing additional terms and the complete Apache License 2.0 text. It is not standard Apache-2.0 and is not OSI-approved. Read the complete terms before using, modifying, or distributing the software.
