# Contributing

Thanks for helping. This repo moves through **pull requests into `main`**; direct pushes to `main` are blocked by a ruleset.

## Workflow

1. **Branch** from `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`.
2. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary` in the imperative, with a body explaining *why*.
   Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `security`.
   Scopes: `api`, `web`, `e2e`, `docs`, `brand`, `seo`, `ci`.
3. **Run the checks** that match your change (below) and add tests for behaviour changes.
4. **Open a PR** using the template. Keep it focused; one logical change per PR.
5. CI (`Backend`, `Frontend`, `E2E`, `Security`) must pass before merge.

## Local checks

```bash
cd backend  && npm ci && npm test
cd frontend && npm ci && npm test && npm run build
cd e2e      && npm ci && npx playwright test          # functional + accessibility + visual (Windows baselines)
```

- API changes: update `docs/openapi.json`; the contract test fails on undeclared statuses or extra fields.
- UI changes: run the visual suite; if the change is intended, `npx playwright test visual --update-snapshots` and review the image diffs in the PR. Zero new axe violations.
- New write paths must be covered by the closed-by-default auth tests.

## UI rule: icon-first

Controls are icons with a tooltip. Use `components/IconAction.js` (`<IconAction label="Edit" icon={<Pencil />} />`): it sets the `aria-label`, the tooltip and `aria-hidden` on the icon for you. Keep a visible text label on primary calls to action and in touch-first menus. Never add an icon-only control without a label; `e2e/tests/icons.spec.js` fails the build if you do.

## Security and secrets

- **Never commit** keys, tokens, passwords, `.env` files, database files or screenshots showing them. Use environment variables; document names (not values) in `.env.example`.
- Found something sensitive in a commit? Stop, rotate it, and tell the maintainer: see [SECURITY.md](SECURITY.md).

## Code style

Small functions, parameterised SQL only, validate input at the boundary, return structured errors, no `console.log` in app code. Match the existing patterns before introducing new ones.
