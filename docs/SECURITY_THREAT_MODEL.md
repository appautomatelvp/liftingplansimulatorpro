# SafeLift3D security threat model

**Reviewed:** 2026-11-13
**Scope:** browser application, Firebase Authentication, Firestore client access, GitHub Actions, Cloudflare Pages preview/production configuration. This document records the controls visible in the repository and the deployment evidence collected so far. A checked control is not a claim that all related production settings have been independently verified.

## System boundary and trust assumptions

- The browser downloads a Vite application from Cloudflare Pages. Firebase Web configuration and a reCAPTCHA/App Check site key are public client identifiers; they are not server credentials.
- Firebase Authentication establishes identity. Firestore Security Rules are the enforcement boundary for browser reads and writes. Client validation and hidden UI are not security controls.
- Firestore currently stores user profiles and bounded equipment/lift-plan metadata. The client caps page reads at 20 records and plan snapshots at 48,000 bytes. Free accounts have 20 slots per collection; Premium/admin profiles can use up to 200.
- The deployed rules allow owners to access their own equipment and plans, reject unmatched paths, and reserve role assignment for trusted provisioning. Admins can list users and change tier/status under the current rules.
- No payment processor, webhook endpoint, feedback backend, email queue, Cloudflare Worker/Function, or Firebase Functions code is present in the current application boundary. Those are future features and must not be treated as protected merely because they appear in the product plan.
- Firebase staging `safelift3d-staging` is isolated from production in the current Cloudflare Preview variables. The Preview OAuth hostname is authorized, a staging-specific App Check key is registered and saved in Cloudflare Preview, and deployment `9dbadb26-b7d1-46b2-b769-8bd0466f0af7` succeeded. Real OAuth sign-in and App Check assessments/metrics on that deployment are not yet verified; enforcement remains off. No Firestore backup schedule exists: creating the production daily/7-day schedule returned HTTP 403 requiring billing to be enabled. Production delete protection is enabled, staging delete protection was already enabled, and restore/release-gate drills are outstanding.

## Threats, controls, and remaining work

### 1. Account creation abuse, credential attacks, and account enumeration

**Threat:** automated signups, password guessing, credential stuffing, or probing sign-in/reset responses can consume authentication capacity and expose whether an email is registered.

**Existing controls:** Firebase Auth owns credential verification; Firestore profile creation is limited to the signed-in UID and requires the token email, `role: user`, `tier: free`, and `status: active`. Client storage quotas bound records per account.

**Gaps / actions:** Auth rate limits, email-enumeration protection, abuse monitoring, and production/staging sign-in behavior have not been independently verified. Review Firebase Auth settings and quotas, use generic user-facing errors where practical, and alert on signup/sign-in spikes. App Check is not a substitute for identity-provider abuse controls.

### 2. Self-promotion or unauthorized account administration

**Threat:** a user edits their profile to grant admin/premium access, unlock a locked account, or change another user's profile.

**Existing controls:** self-updates are restricted to `lastLogin`; self-created profiles require the fixed user/free/active values; role changes cannot be made by the client; admin changes are limited to tier/status values. Locked/banned users fail the active-owner check.

**Gaps / actions:** the current admin model is a single `admin` role without MFA enforcement, separation of duties, just-in-time access, or immutable audit events. Provision roles through a trusted operator path, require MFA for privileged accounts, and add server-written audit records before expanding CMS actions. Verify locked-user and admin negative cases in the Emulator suite.

### 3. Cross-account reads/writes and insecure direct object references

**Threat:** changing a UID or document ID in browser requests exposes or alters another customer's equipment or lift plans.

**Existing controls:** Firestore Rules require the authenticated UID to match the user path and the profile to be active; records include `ownerUid`; record schemas and allowed paths are constrained; catch-all access is denied. Client helpers address the signed-in user's subcollections.

**Gaps / actions:** the Emulator now verifies 12 cases, including cross-user get/list/update/delete, locked-user access, profile role/tier tampering, invalid fields, oversized payloads, slot limits, and admin boundaries. Add create-path and additional quota/concurrency cases as the data model expands; repeat with staging data before release. Never rely solely on client-side UID checks.

### 4. Firestore cost amplification and document flooding

**Threat:** repeated reads/writes, parallel slot creation, oversized metadata, or many accounts amplify Firebase usage and cost.

**Existing controls:** rules limit document schema, text/numeric ranges, equipment/plan IDs to bounded slots (1–20 Free or dynamic limit ≤200, 1–200 Premium), plan snapshots to 48,000 characters, and `equipmentIds` to 20. Client list pages are limited to 20 (50 for `catalog`, 25–26 for admin tables); create uses a transaction to detect an occupied slot. `users/{uid}/meta/usage` tracks UTC daily writes (capped at `<= 200` on `meta/usage` itself with monotonic `+1` per UTC day), but is **client-side telemetry / soft quota** rather than a rule blocking unbatched writes to `equipment` or `liftPlans` (using `getAfter` on every write would add extra rule reads against Spark quotas).

**Gaps / actions:** per-account slot caps do not prevent a modified client from skipping `meta/usage` increments when writing directly to `equipment`/`liftPlans` or creating multiple accounts, and client telemetry is not a security barrier against request-rate abuse. Keep slot caps and strict schema/size rules as the authoritative Firestore Rules boundaries, set Spark/Firebase usage alerts, and defer server-side rate limiting until trusted backend endpoints exist. Keep 3D binaries out of Firestore.

### 5. App Check bypass or wrong-environment Firebase access

**Threat:** automated clients call Firebase directly, or Preview accidentally uses production project credentials/App Check configuration.

**Existing controls:** deployment validation distinguishes production from staging; Preview has separate Firebase staging variables; the App Check resolver deliberately avoids falling back to the production site key in isolated preview/staging builds; production builds require a site key.

**Gaps / actions:** a staging-specific Preview site key is configured, but live App Check assessments and valid traffic metrics are not yet verified. Enforcement remains off until valid clients are observed. Production enforcement state is not independently verified. Confirm hostnames, observe valid traffic, then enable enforcement service by service. Validate environment isolation in CI and inspect the built bundle. App Check reduces unauthorized client traffic but does not replace Firestore Rules, quotas, or server authorization.

### 6. OAuth redirect/domain errors

**Threat:** an unauthorized OAuth domain prevents legitimate sign-in; an unsafe redirect configuration could send users to an unintended origin.

**Existing controls:** Google sign-in uses Firebase Auth and the app uses configured Firebase projects.

**Gaps / actions:** staging Preview hostname `codex-safelift-g0-ci.safelift3d.pages.dev` has been added to Firebase authorized domains. Test real sign-in and sign-out on both production and Preview. Do not broaden redirect domains unnecessarily. `safelift3d.com` is already in the production configuration.

### 7. Feedback/email abuse and personal information exposure

**Threat:** a public feedback endpoint could be spammed to generate email/storage cost, or messages could expose personal/customer data.

**Existing controls:** the current contact action opens a bounded `mailto` draft; it does not create a server ticket or send mail from SafeLift3D.

**Gaps / actions:** no server feedback inbox, rate limiter, retention policy, or email secret exists. If implemented, require authenticated identity and App Check where suitable, validate/limit payloads server-side, enforce per-user/IP quotas and deduplication, queue outbound email with bounded retries, restrict admin access, and define retention/deletion. Never put email provider credentials in the Vite bundle.

### 8. Fake payment, price manipulation, and replayed webhooks

**Threat:** a modified client changes a price/tier/balance, fabricates a payment success redirect, or replays/tampers with a webhook.

**Existing controls:** there is no billing or webhook implementation to attack today; Firestore client rules do not give users permission to change their tier or role.

**Required before billing:** keep catalog prices and entitlements server-owned; create checkout on a trusted backend from a versioned catalog; verify webhook signatures and amount/currency; enforce idempotency and event ordering; write immutable payment/ledger/audit records transactionally; reconcile refunds/chargebacks. Treat browser redirects as display-only. Do not collect card data in the application.

### 9. Privileged account compromise and excessive admin access

**Threat:** stolen admin credentials or an overly broad operator role enables user enumeration, account locking, or entitlement manipulation.

**Existing controls:** Firestore admin access requires an active profile with `role == admin`; client cannot assign that role.

**Gaps / actions:** MFA, admin access reviews, role separation, audit trail, and break-glass procedure are not verified. Enforce MFA for administrators, minimize the number of admins, log actor/target/reason and before/after values in a trusted append-only path, and alert on privileged changes. Do not place admin secrets in client code.

### 10. Data loss, malicious dependency/build changes, and secret leakage

**Threat:** accidental deletion, unsafe restore, compromised dependency/action, malicious build changes, or a committed server secret can affect all environments.

**Existing controls:** GitHub CI runs tests, architecture checks, Firestore Rules Emulator, and Gitleaks against repository history; workflow actions are pinned to commit SHAs; production and staging are split; staging Firestore delete protection is enabled.

**Existing controls:** production Firestore delete protection has now been enabled; staging database already had it enabled. This reduces accidental database deletion but does not back up data.

**Gaps / actions:** CLI inspection confirmed there is no scheduled backup on either database. Creating a daily production schedule with 7-day retention returned HTTP 403 because Google requires billing to be enabled; billing was not enabled. Backup retention, encryption/access policy, and a restore drill remain outstanding. Define recovery point/time targets and test restore after the project owner enables billing. Continue dependency/action review and secret scanning. Firebase web config and App Check site keys are public identifiers; any service-account, payment, signing, or email private key must stay in a server-side secret store and must be rotated if exposed.

## Release priorities

1. Finish G0.03/G0.05: confirm OAuth hosts, staging App Check, production release gates, and backup/restore evidence.
2. Keep expanding G0.07 Emulator cases for denial boundaries and quota/schema abuse as backend features are added; 12 Firestore Rules cases currently pass in CI.
3. Complete G0.08 cost/error alerts and G0.09 admin MFA/audit controls before opening CMS capabilities or customer data at scale.
4. Do not launch feedback sending or billing until the corresponding server-side rate-limit, secret handling, audit, idempotency, and abuse controls are implemented and tested.

## Evidence captured

- Repository state reviewed 2026-11-13; Firestore rules and workspace data validators inspected.
- Local application suite: 266/266 tests passed after Vite 6.4.6/Vitest 4.1.12 update; architecture gate and production build passed. `npm audit` reports 0 vulnerabilities. The bundle still emits a large-chunk warning.
- GitHub CI run `43415934866` passed for commit `125599c` (`test: expand firestore security rules coverage`), including the 12 Firestore Rules Emulator cases. Cloudflare Preview deployment `9dbadb26-b7d1-46b2-b769-8bd0466f0af7` for commit `7854c43` built and deployed successfully after the staging App Check key was added. The build log reported 5 dependency vulnerabilities and large bundle warnings; these are not login/App Check test results.
- These checks do not prove live Preview OAuth, App Check enforcement, production backup/restore, or the state of Firebase Console settings not visible to the repository.
