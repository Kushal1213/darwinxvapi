# Operations Runbook

Reviewed: 2026-10-07

This runbook covers the repository-supported dedicated tenant stack. It does not replace
a customer incident plan, cloud backup policy, provider support agreement, or legal/data-
retention decision.

## Release Gate

From the repository root:

```powershell
npm ci
python -m pip install -r services/requirements.txt
npm run verify
```

The gate runs provider-free tests, the seven-case grounding fixture, a production frontend
build, tenant isolation/recovery tests, and a full npm dependency audit. A pass establishes
local reproducibility only; it is not a live-provider or production certification.

## Incident Pause

1. Sign in as an administrator and open **Operations**.
2. Pause the smallest affected capability and record the incident, rollback, or verification
   reason. Pausing new sessions does not remove review access. Knowledge queue pauses wait
   without exhausting retry counts.
3. If provider behavior is uncertain, pause `new_sessions`, `customer_answer_generation`,
   `private_guidance`, `guided_delivery`, and `proactive_nudges` before revoking provider
   credentials.
4. Verify the global degraded-state banner, `/api/health`, and Operations audit trail.
5. Resume one capability at a time only after the relevant check passes, using a new reason.

Provider-account suspension, key revocation, quota changes, and billing controls must be
performed in the authorized provider account by its owner. Never paste a provider secret
into an incident ticket or repository file.

## Backup

Stop the tenant first. The command refuses a tenant with a runtime lock and refuses to
overwrite an existing destination.

```powershell
npm run tenant -- backup <tenant-id> <new-backup-directory>
npm run tenant -- verify-backup <backup-directory>
```

The snapshot includes the tenant database, private configuration, knowledge snapshots,
and tenant-owned files. `backup-manifest.json` records a SHA-256 digest and size for every
file. Treat the backup as secret material because it contains credentials and customer data.
Store it in encrypted, access-controlled storage outside the repository.

## Restore Drill

Restore is fail-closed: the manifest must verify, its tenant ID must match, and the target
tenant must not already exist.

```powershell
npm run tenant -- verify-backup <backup-directory>
npm run tenant -- restore <backup-directory> <tenant-id>
npm run tenant -- start <tenant-id>
```

After startup, sign in and verify workspace health, one historical call, the active knowledge
generation, and an approved citation. Restore into an isolated host or empty tenant root for
a drill; never overwrite the only live copy.

## Decommission

Pause new sessions and provider-driven activity, stop the stack, revoke external provider
credentials, and confirm the applicable retention decision. The CLI requires an exact tenant
ID confirmation, creates and verifies a recovery backup, then removes the local tenant data.

```powershell
npm run tenant -- decommission <tenant-id> <new-backup-directory> --confirm=<tenant-id>
npm run tenant -- verify-backup <backup-directory>
```

The verified recovery backup remains. Its later destruction is intentionally outside this
command because retention approval and storage ownership are customer-specific.

## Drill Evidence

Record the release commit, operator, timestamps, affected tenant, control-event IDs, backup
location identifier (not a credential), manifest digest, restore result, provider actions,
and follow-up owner. Never copy transcripts, passwords, API keys, or raw backup contents into
the evidence record.
