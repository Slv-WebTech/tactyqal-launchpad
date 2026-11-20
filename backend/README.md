<div align="center">
<img src="../docs/assets/logo.svg" width="72" alt="Tactyqal Labs"/>

# Blog API

**Express 4 + `node:sqlite`: a small, secure, fully tested REST API for blog content.**
</div>

## Run

```bash
npm install
ALLOW_OPEN_WRITES=1 npm start        # local dev: writes open
ADMIN_KEY=<24+ random chars> npm start   # or require a key (header: x-admin-key)
npm test                              # 45 tests: unit, edge, hardening, contract, fuzz
```

Requires Node ≥ 22.5. Writes are **closed by default** (see [`src/config.js`](src/config.js)); `ALLOW_OPEN_WRITES=1` is refused when `NODE_ENV=production`.

## Layout

| File | Role |
|---|---|
| `src/server.js` | Boot, seed, graceful shutdown, keep-alive tuning |
| `src/app.js` | Routes, validation, auth, error handling |
| `src/config.js` | Fail-safe config rules |
| `src/db.js` | Schema, migrations, `tx()` transaction helper |
| `src/seed.js` | Six sample posts |
| `test/*.test.js` | Unit, edge, hardening, OpenAPI contract, seeded fuzz |

## Configuration

`PORT` (4000) · `DB_FILE` (`blog.db`, `:memory:` in tests) · `ADMIN_KEY` · `ALLOW_OPEN_WRITES` · `NODE_ENV`. See [`.env.example`](.env.example); never commit real values.

Contract: [`../docs/openapi.json`](../docs/openapi.json). Architecture notes: [`../CONTEXT.md`](../CONTEXT.md).
