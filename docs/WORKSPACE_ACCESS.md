# Workspace Access and Persistence

This milestone provides one authenticated workspace per Veyra installation.
The first account is an administrator. Admins can invite admins/operators, change
access, and disable accounts. Password recovery, MFA, SSO, and multiple workspaces
are not implemented. See [Team Access](TEAM_ACCESS.md) for the permission matrix.

## Local Setup

Use Node 22.13 or newer and run `npm install` followed by `npm run dev`.
Open the frontend, enter a workspace name, owner email, and password of 12-256
characters. There are no built-in credentials. Local first-run setup is limited
to loopback requests and allowed frontend origins. After setup, the setup endpoint
returns 409 and the UI presents sign-in.

Accounts and calls live in repository-root `data/veyra.sqlite` by default. Use an
absolute `VEYRA_DATABASE_PATH` to put the database elsewhere. Do not delete the
database to reset a password: that would also delete call history. Account recovery
still requires a future administrative workflow.

## API and Session Rules

| Endpoint | Authentication | Behavior |
|---|---|---|
| `GET /api/auth/session` | Public | Sign-in state, workspace name, setup availability |
| `POST /api/auth/setup` | First-run authorization | Create the single owner and sign in |
| `POST /api/auth/login` | Email/password | Rotate session ID and sign in |
| `POST /api/auth/logout` | Cookie session | Revoke session and disconnect its sockets |
| `POST /api/auth/accept-invite` | Single-use invitation token | Set password and join workspace |
| `/api/team/*` | Admin cookie session | Manage members and invitations |
| All other `/api/*` endpoints | Cookie session or narrowly scoped provider token | Access workspace data |

Passwords use per-user random salts and Node's scrypt, with timing-safe hash
comparison. Browser sessions use signed, HttpOnly, SameSite=Strict cookies backed
by SQLite and a fixed 12-hour lifetime. Session IDs rotate on login; authentication
survives a gateway restart. The frontend rechecks authentication on window focus
and every minute. APIs reject expired sessions immediately; existing sockets are
disconnected at expiry or logout.

Mutating requests require an exact allowed Origin. Development allows localhost ports
3000 and 5173 plus `FRONTEND_URL`; production uses only `FRONTEND_URL`. Setup/login/invitation acceptance
share a 20-request, 15-minute per-IP limit. That limiter is process-local and resets
when the gateway restarts.

## Provider Callbacks

External provider callbacks do not have a browser cookie. Configure a random
`VOICE_SERVICE_TOKEN` of at least 32 characters and send it as
`Authorization: Bearer <token>` from the provider's server configuration.
This token is accepted only on:

- `/api/voice/webhook`
- `/api/voice/vapi-llm`
- `/api/transcript/chunk`
- `/api/transcript/signal`

It cannot read history, manage accounts, or access other APIs. Provider configuration
is manual in this milestone; never expose this token in browser configuration.

## Deployment Configuration

For `NODE_ENV=production`, configure:

- `FRONTEND_URL`: exact HTTPS browser origin, without a trailing slash.
- `AUTH_SESSION_SECRET`: random secret of at least 32 characters.
- `WORKSPACE_SETUP_TOKEN`: secret entered during first setup; remove after setup.
- `VEYRA_DATABASE_PATH`: persistent local disk, retained across deployments.
- `TRUST_PROXY=1` only when directly behind one trusted HTTPS reverse proxy.

Production cookies require HTTPS. Missing production session configuration fails
startup. The gateway must be the only exposed application API; Python services
remain private/local and do not authenticate browser users. Keep the SQLite file,
WAL/SHM files, and legacy archives private. Use SQLite-aware backup tooling or stop
the gateway before copying the database.

The workspace marker is not tenant isolation. The FAISS index, provider credentials,
and realtime service are still installation-wide. Run one gateway process per
database: live call caching and duplicate-turn locks are process-local.

For separate tenant installations, use the [dedicated stack launcher](TENANT_STACKS.md).
It provisions separate storage, credentials, services, and cookies without changing
the existing workspace. Shared-process multi-tenancy remains unsupported.

## Verification

The dependency audit on 2026-10-07 reports zero advisories across production and
development dependencies after the Vite 8 and Tailwind 4 migration. Development servers
remain local tools and must not be exposed as production ingress.
Node 22 currently emits an experimental warning for its built-in SQLite API.

`npm run test --workspace apps/api-gateway` covers archive migration, authenticated
call workflows, active-call recovery, login persistence, cross-origin rejection,
cookie revocation, unauthenticated sockets, and logout socket disconnection.

For isolated browser checks, run `node apps/api-gateway/test/browser-server.mjs`.
It starts a temporary workspace at localhost:3010 with its gateway at :3014. These
ports must be free. Its database is separate from the real workspace and is left
in the printed temporary directory for inspection. Stop it with Ctrl+C.
