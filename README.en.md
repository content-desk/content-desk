# ContentDesk

[简体中文](README.md) | **English**

An early-stage project intended to become a local-first, AI-assisted content workspace for individual creators, one-person businesses, and small content teams.

> **Current status: infrastructure stage; not production-ready.** The current runnable path is Web plus Server, with API connectivity checks, email/password authentication, and a protected route. A Native prototype also exists but does not pass an independent type check. ContentDesk's project management, content creation, local storage, Desktop, and AI capabilities have not been implemented. See [Quick start](#quick-start).

## Overview

ContentDesk is intended to organize project files, sources, documents, scripts, storyboards, and generated assets in one content workspace for individuals and small teams that continuously collect, create, produce, and reuse content. It targets the loss of context that happens when chat histories, asset folders, and separate creation tools do not share a durable project model—not merely the problem of having a single conversation.

The product direction makes projects and their files the source of truth for content, with Chat as one way to operate on a project. This is a direction, not a claim about current features: the repository still mostly contains the application skeleton generated from Better-T-Stack.

## Current status

| Status | Capability | Details |
| --- | --- | --- |
| Runnable foundation | Web and Server foundations | Web can check API status; Server exposes Hono, oRPC, and OpenAPI entry points |
| Runnable foundation | Email/password authentication | Better Auth, PostgreSQL auth tables, Web sign-in and sign-up UIs, and a protected Web route |
| Prototype | Native foundation | Contains API status, authentication UI, and theme code, but currently fails an independent TypeScript check |
| In development | ContentDesk product experience | Generic message UI components exist, but they are not connected to Chat, projects, or content data |
| Planned | Desktop and local-first data layer | There is currently no Electron app, SQLite database, Workspace Files layer, or local project model |
| Planned | Content workflow and AI | Project, Document, Script, Storyboard, Asset, publishing/review, and AI Providers are not implemented |
| Template/placeholder | Browser extension and documentation site | The WXT extension only has a placeholder popup and sample content script; Fumadocs still contains template content |

There is no usable Electron Desktop application and no LLM, image, audio, or video generation Provider integration. The presence of a dependency or UI component does not mean the corresponding product capability is complete.

## Product direction

These principles describe where ContentDesk is intended to go:

- **Local-first:** content and project files should remain under the user's control. The current implementation has not reached this goal; authentication data is still stored in the Server's PostgreSQL database.
- **Projects are the source of truth:** content context should belong to projects and files, rather than live only in chat history.
- **Chat is one interface:** structured editing, organization, and production interfaces will not be replaced by a generic chat surface.
- **Replaceable AI, useful without AI:** future versions should allow Provider choice, while project and content management should continue to work without AI.

## Target workflow

The target lifecycle is:

```text
Capture → Analyze and organize → Create → Produce assets → Publish and reuse → Review data
```

The source code does not yet provide this end-to-end workflow. The near-term scope is to establish `Project → Document/Script → Storyboard → Asset` first, then connect capture, generation, publishing, and review.

## Current architecture and data boundaries

The current primary path is a client/server scaffold, not a local-first Desktop architecture:

```text
Web (React) ─────┐
                 ├─ HTTP / oRPC / Better Auth ─ Hono Server ─ PostgreSQL
Native (Expo) ───┘
```

- **Web** is the most direct browser entry point and runs at `http://localhost:3001` by default.
- **Server** runs at `http://localhost:3000` by default and provides a health check, authentication, a protected example endpoint, and an OpenAPI reference handler.
- **Native** is an Expo/React Native prototype that uses the same authentication and oRPC Server. It is not yet a mobile capture or creation product, and it currently has a Better Auth client type incompatibility.
- **Extension** and **Fumadocs** are workspace members, but neither is part of a usable product path today.
- There is no **Desktop** directory or Electron configuration.

The database currently defines only the Better Auth `user`, `session`, `account`, and `verification` tables. The `account.providerId` field represents an authentication account and does not indicate AI Provider support. There are no Project, Document, Script, Storyboard, Asset, or Conversation models, and no database migration files.

### Data, network, and privacy

- Authentication data and sessions are written by the Server to PostgreSQL. There is no SQLite database, IndexedDB content store, or workspace file storage.
- Web uses cookies for authentication and API access. Native uses Expo SecureStore for Better Auth client session information.
- In development, the Server uses evlog and writes logs under the local `.evlog/` directory.
- Current Web and Native authentication/API features require the Server. Account sync, local content backup, export, migration, and uninstall cleanup flows do not exist.
- There are no AI requests today. Once third-party AI Providers are integrated, the data sent to them will need to be documented from the actual implementation.

The current repository therefore must not be described as fully offline or as guaranteeing that data never leaves the device.

## Repository structure

```text
apps/
├── web/          React + TanStack Router Web/PWA foundation
├── server/       Hono Server, oRPC/OpenAPI, and authentication entry point
├── native/       Expo + React Native prototype
├── extension/    Placeholder WXT browser extension
└── fumadocs/     Template Fumadocs documentation site
packages/
├── api/          Shared oRPC context, procedures, and example router
├── auth/         Better Auth configuration
├── db/           Drizzle/PostgreSQL connection and authentication schema
├── env/          Server, Web, and Native environment validation
├── ui/           Shared React UI components and styles
└── config/       Shared TypeScript configuration
```

The root uses a pnpm workspace and Turborepo for task orchestration. `docker-compose.yml` defines Web, Server, and PostgreSQL services.

## Quick start

### Requirements

- Node.js: the repository has no `.nvmrc`, `.node-version`, or `engines` constraint. Docker builds use Node.js 24.
- pnpm `11.21.0`: pinned by `packageManager` in the root `package.json`.
- Docker and Docker Compose: required to use the included PostgreSQL service or run the full container stack.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

The repository does not currently include an `.env.example`. Create or edit the following Git-ignored files, and never commit secrets:

`apps/server/.env`

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/content-desk
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

`apps/web/.env`

```dotenv
VITE_SERVER_URL=http://localhost:3000
```

`apps/native/.env` is required only when running Native:

```dotenv
EXPO_PUBLIC_SERVER_URL=http://YOUR-LAN-IP:3000
```

A physical device must use a Server address it can reach, rather than the device's own `localhost`.

### 3. Prepare the database

```bash
pnpm run db:start
pnpm run db:push
```

`db:start` starts PostgreSQL through Docker Compose. `db:push` applies the current authentication schema to that database.

### 4. Start Server and Web

Run these commands in separate terminals:

```bash
pnpm run dev:server
```

```bash
pnpm run dev:web
```

Open `http://localhost:3001`. The Server health check is available at `http://localhost:3000/`.

The root `pnpm run dev` command launches every workspace `dev` task and is not currently suitable as the primary startup command: Server and Fumadocs both use port `3000` by default.

### 5. Optional: start Native

After the Server and database are running and the Native environment variable is configured, run:

```bash
pnpm run dev:native
```

## Configuration and AI Providers

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server / Drizzle | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Server | Better Auth secret; at least 32 characters |
| `BETTER_AUTH_URL` | Server | Base URL of the Better Auth Server |
| `CORS_ORIGIN` | Server | Web origin allowed to access the Server with credentials |
| `VITE_SERVER_URL` | Web | oRPC and authentication Server URL |
| `EXPO_PUBLIC_SERVER_URL` | Native | oRPC and authentication Server URL used by Native |

There is currently no AI Provider, API key configuration, custom AI Base URL, or Provider settings screen. OpenAI Compatible API, Anthropic/Claude, AWS Bedrock, Azure OpenAI, and Google Vertex AI are not integrated. Authentication Provider fields are unrelated to AI Providers.

## Development commands

Run all commands below from the repository root:

| Command | Purpose |
| --- | --- |
| `pnpm run dev:web` | Start the Web development server |
| `pnpm run dev:server` | Start the Server development process |
| `pnpm run dev:native` | Start the Expo development server |
| `pnpm --filter extension dev` | Start WXT extension development mode |
| `pnpm --filter fumadocs dev` | Start the template documentation site; its default port conflicts with Server |
| `pnpm run check` | Run static checks with Ultracite/Biome |
| `pnpm run check-types` | Type-check workspaces that define a `check-types` script |
| `pnpm run build` | Build Web, Server, Extension, and Fumadocs; Native has no `build` script |
| `pnpm --filter extension build` | Build the Chromium extension |
| `pnpm --filter extension build:firefox` | Build the Firefox extension |
| `pnpm --filter fumadocs build` | Build the template documentation site |
| `pnpm run db:generate` | Generate Drizzle migration files |
| `pnpm run db:migrate` | Apply existing Drizzle migrations |
| `pnpm run db:push` | Push the schema directly to the database |
| `pnpm run db:studio` | Start Drizzle Studio |
| `pnpm run docker:build` | Build the Web and Server container images |
| `pnpm run docker:up` | Build and start Web, Server, and PostgreSQL |
| `pnpm run docker:down` | Stop and remove Compose services |

The repository currently has no `test` script, unit tests, integration tests, or E2E configuration. Root type checking also does not cover Native or Extension: Extension separately provides `pnpm --filter extension compile`; Native has no project-level type-check script, and `pnpm --filter native exec tsc --noEmit` fails because of a Better Auth client type incompatibility.

## Roadmap

The roadmap is not a list of current features. Near-term work is ordered by dependency:

1. Establish a runnable Desktop shell, local project model, and user-controlled file storage.
2. Complete a non-AI `Project → Document/Script → Storyboard → Asset` foundation.
3. Add Desktop Chat, settings, and replaceable AI Providers.
4. Turn the browser extension and mobile app from templates into capture and review entry points.
5. After the core content model is stable, expand into image, audio, and video production, followed by publishing, reuse, and performance review.

## What this project is not building now

At this stage, ContentDesk is not being built as a general-purpose chat client, a general Agent Runtime, a developer workflow orchestration platform, a full video editor, an enterprise digital asset management system, or an already mature all-in-one publishing platform. The current priority is a small but complete content-work loop that works in practice.

## License

ContentDesk is distributed under the repository's [ContentDesk License](LICENSE), with an accompanying [NOTICE](NOTICE). It is a custom source-available license that includes additional conditions and the complete Apache License 2.0 text. It is not standard Apache-2.0 and is not an OSI-approved open-source license. Read the complete terms before using, modifying, or distributing the software.
