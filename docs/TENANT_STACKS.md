# Dedicated Tenant Stacks

Veyra now has a supported local provisioning path for a dedicated stack per tenant.
Each tenant gets its own five processes, SQLite database, knowledge index, raw
uploads directory, history import directory, session secret, callback token, and
cookie name. Call caches, nudge controllers, and socket broadcasts stay inside
that tenant's processes.

This is not shared-process multi-tenancy, and the launcher is not a production
deployment system. Database workspace IDs remain local to each stack.

## Provision and Run

From the repository root with Node 22.13+, installed npm dependencies, and the
existing Python service dependencies:

```powershell
npm run tenant -- init acme 4100
npm run tenant -- start acme
```

The init command creates data/tenants/acme/tenant.json and a private .env containing
fresh session/callback credentials. It never overwrites an existing tenant.
Configure provider keys in that tenant's .env before starting. There are no provider
keys or customer records copied from the root workspace.

The base port assigns five consecutive ports:

| Offset | Service |
| --- | --- |
| 0 | Browser frontend |
| 1 | API gateway and sockets |
| 2 | RAG |
| 3 | Ingestion |
| 4 | Realtime insights |

Open http://localhost:4100 and create that tenant's first admin. A second tenant
can use a non-overlapping range, for example init northwind 4200. Start each in a
separate terminal. Ctrl+C stops its direct child processes. Python reload workers
are deliberately not used in this launcher; restart after server-code changes.
Set PYTHON in the launching shell to choose a Python executable.

## Storage and Credentials

- veyra.sqlite: users, invitations, sessions, calls, nudges, documents, audit events.
- knowledge/: tenant-only FAISS snapshots; new tenants start with no reference corpus.
- raw/: tenant-only legacy ingestion upload files.
- legacy-calls/: the only directory eligible for that tenant's old history import.
- .env: provider settings and session/callback secrets.
- runtime.lock: supervisor PID; an active lock prevents a second tenant instance.
- Vite dependency caches use a separate hashed directory under node_modules/.vite-tenants.

Allowed .env settings are AUTH_SESSION_SECRET, VOICE_SERVICE_TOKEN, GEMINI_API_KEY,
GEMINI_MODEL, VAPI_API_KEY, VITE_VAPI_PUBLIC_KEY, and PUBLIC_WEBHOOK_URL. Unknown
settings fail startup. Routing, database, index, and raw paths are derived from the
profile and cannot be redirected by .env values.

Only basic OS/runtime variables are inherited by children. Application settings
from the shell or the root .env are not inherited. VITE_VAPI_PUBLIC_KEY is public;
never place a private credential in any VITE_ setting. Tokens are not printed.
Vapi assistant names include the tenant ID to avoid assistant-name collisions.
Use separately scoped provider accounts/projects and configure each callback
endpoint with its matching token. Live provider isolation has not been verified.

Tenant runtime data is ignored by Git and denied by Vite's file-serving rules.
The browser session cookie is veyra.<tenant-id>.sid, so local ports can coexist
without overwriting each other's cookies. Secrets differ, so renaming one
tenant's cookie does not authenticate it against another gateway.

## Failure Behavior

The launcher checks all five ports before starting anything and refuses busy ports.
Each service must become healthy within 45 seconds. If startup or any child fails,
the supervisor stops sibling services and removes its lock. The CLI reports failure.
Normal shutdown preserves data. Restart uses the same credentials and storage.
An abandoned lock is removed only when its recorded process no longer exists.
A reused/live PID or malformed lock requires manual inspection, not automatic deletion.

No migration or deletion of the existing root database/index is performed.
The original npm run dev workflow remains available.

## Security Boundary and Remaining Work

All tenant services bind to loopback. This mode is for a trusted local administrator;
anyone with local filesystem/process access can inspect tenant data, and direct
Python service ports are not authenticated. Separate processes on one OS account
are not a hardened boundary against hostile local users.

For customer deployment, use separate containers/VMs, private service networks,
per-tenant storage permissions and backups, and an authenticated HTTPS ingress.
Do not expose Vite or direct Python ports publicly. Use production cookies and
session configuration in a production deployment, not this development launcher.
On Windows, credential files inherit the directory ACL; mode 0600 is not an ACL.

There is no tenant-switching UI, shared control plane, billing/provisioning service,
cross-tenant membership, shared-worker scoping, or database row-level isolation.
Those require a separate architecture milestone. Knowledge approval, durable
processing, retention, and dependency remediation also remain open.

## Verification

```powershell
npm run test:tenants
npm run test --workspace apps/api-gateway
python -m unittest discover -s services -p test_managed_knowledge.py
npm run build --workspace apps/frontend
```

The isolation suite starts two real stacks with temporary storage and no provider
keys. It verifies cookie/origin boundaries, identical call/document IDs, realtime
events, document APIs, retrieval results, provider-token rejection, file-serving
denials, restart persistence, and cleanup after service failure.
Retrieval fixtures use deterministic fake vectors; no paid provider calls occur.
For browser inspection, node scripts/tenant-browser.mjs starts a temporary stack
at localhost:4110 without changing existing workspace accounts.
