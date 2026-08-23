# Security Policy

## Supported Versions

Only the `main` branch is supported. There are no releases, tags, or backports —
if you run an older commit, update before reporting.

## Reporting a Vulnerability

Please report security issues through **GitHub's private vulnerability reporting**:
open the [Security tab](../../security/advisories/new) and choose *Report a
vulnerability*. This keeps the report private until a fix exists.

Please do **not** open a public issue for anything exploitable, and do not use
pull requests to disclose a vulnerability.

Useful in a report: the affected file or endpoint, what an attacker gains, and the
smallest set of steps that shows it.

## Scope

In scope — the parts that guard someone else's notes:

- Authentication and sessions: `lib/auth.ts`, `lib/users.ts`, `proxy.ts`
- Share links: `lib/fsShares.ts` and the `/share/` routes
- Attachment upload, storage, and download paths
- Anything that lets one user read or modify another user's notes

Out of scope:

- The deploy scripts (`scripts/deploy.sh`) and any Synology/DSM configuration —
  these describe *my* setup and are not a product
- Reverse-proxy, TLS, or network hardening of your own instance
- Vulnerabilities in third-party dependencies — report those upstream
- Findings that require an attacker who already has shell access to the host
- Missing hardening without a demonstrable impact (headers, rate-limit tuning,
  scrypt cost parameters — the last one is a documented trade-off in `lib/users.ts`)

## What to Expect

This is a single-maintainer hobby project, self-hosted by design. I read reports
and fix what is real, but this is **best effort: no SLA, no guaranteed response
time, no bounty.** Credit in the commit or advisory on request.
