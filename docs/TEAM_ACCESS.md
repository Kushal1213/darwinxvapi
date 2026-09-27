# Team Access

Veyra supports multiple accounts inside one installation-wide workspace.
This is role enforcement, not multi-tenant isolation.

## Permissions

| Capability | Admin | Operator | Disabled |
| --- | --- | --- | --- |
| Calls, transcripts, handoffs, nudges, CRM actions | Yes | Yes | No |
| Call history and knowledge inspection/search | Yes | Yes | No |
| Upload, retry, restore, archive knowledge | Yes | No | No |
| List team, invite, revoke invitations, change access | Yes | No | No |
| Sign in or connect to realtime sockets | Yes | Yes | No |

The operator role trusts members with all workspace conversations, existing voice
launch/configuration flows, and operational actions. It is not a read-only role.
UI controls reflect roles, but HTTP middleware enforces permissions independently.
Provider tokens remain limited to the existing callback allowlist and cannot manage teams.

## Invitations

1. An admin opens Team and enters the invitee email and role.
2. The server returns a random 256-bit token once, with a 48-hour expiry.
3. Share the token privately with the intended recipient using a trusted channel.
4. The recipient opens Veyra, selects Join with invitation, and sets a 12-256 character password.

Email delivery and verified email ownership are not implemented. Possession of the
token grants the invited account, so treat tokens as credentials. Tokens are not
placed in URLs or browser storage. SQLite stores only SHA-256 token hashes.
If lost, revoke the pending invitation and issue a new one. Existing accounts,
including disabled accounts, cannot be invited again; admins can change their access.

Acceptance revalidates expiry, revocation, creator authority, and existing accounts
inside a transaction after password hashing. A token can create only one account.
Disabling or demoting an admin also revokes their unaccepted invitations.
Invitation acceptance shares the existing sign-in rate limit.

## Access Changes

Admins can select Admin, Operator, or Disabled. At least one admin must remain.
The original setup account has no special privileges beyond its admin role.
Changing access deletes that user's sessions and disconnects all current sockets;
re-enabling an account does not resurrect old sessions. The member must sign in again.
Socket packets also validate current user/session access before dispatch.
Already-authorized in-flight HTTP work is not cancelled.

The database retains users for call/nudge attribution. Disable is not deletion.
Team events record actor, target, action, and timestamp in team_events. A user-facing
audit viewer, password changes/recovery, MFA, SSO, and custom roles remain future work.
Run one gateway process: immediate socket revocation is process-local.

## API

- GET /api/team: members and unexpired pending invitations; no hashes or passwords.
- POST /api/team/invites: email and admin/operator role; returns token once.
- POST /api/team/invites/:id/revoke: invalidate a pending token.
- PATCH /api/team/users/:id: role of admin, operator, or disabled.
- POST /api/auth/accept-invite: token and password; creates the account and signs in.

All mutations require the configured frontend Origin. The invitation acceptance
endpoint is public only in the sense that no prior cookie is required.

## Verification

Run npm run test --workspace apps/api-gateway and npm run build --workspace apps/frontend.
team.test.js covers token hashing/replay, email binding, permissions, disabled login,
session/socket revocation, last-admin protection, invalid roles, expiry/revocation,
and restart persistence. For browser QA, run node apps/api-gateway/test/browser-server.mjs
and use two separate browser sessions at http://localhost:3010. Its temporary database
is separate from the real workspace. No test accounts are created in the real database.
