# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting:
**Security → Report a vulnerability** on this repository
(<https://github.com/Slv-WebTech/tactyqal-launchpad/security/advisories/new>).

Include what you found, how to reproduce it, and the impact. You'll get an acknowledgement within a few days. This is a hobby/hire-a-thon project without a bug bounty.

## Supported versions

Only the latest `main` (deployed to https://tactyqal-launchpad.vercel.app and the API at https://tactyqal-launchpad-api.onrender.com).

## Security model (summary)

| Area | Behaviour |
|---|---|
| Writes | **Closed by default.** Without `ADMIN_KEY` configured every write returns `401`; `ALLOW_OPEN_WRITES=1` is a local-development opt-in and is refused when `NODE_ENV=production` |
| Credentials | `ADMIN_KEY` ≥ 24 chars, compared in constant time, sent as `x-admin-key`; stored only in host environment variables |
| Drafts | Visible only with the key (by id, slug and list) |
| Injection | All SQL parameterised; HTML escaped before markdown formatting; fuzz-tested |
| Errors | Structured JSON; no stack traces, SQL or file paths |
| Dependencies | `npm audit` clean; Dependabot enabled; CI gating on high-severity advisories lands with the pipeline PR |

Known gaps (see `CONTEXT.md`): no rate limiting or CSP on the API, `cover_image` is not URL-validated.

## Handling secrets

- No secrets belong in the repository, issues, PRs, logs or screenshots. A credential-pattern scan runs in CI once the pipeline lands; until then run `git grep` for secrets before pushing.
- If a secret is exposed: rotate it immediately (change `ADMIN_KEY` in the host dashboard), then remove it from history if needed and report it privately.
