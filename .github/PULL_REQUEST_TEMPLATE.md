## What and why
<!-- One or two sentences: the change and the reason. Link issues: Closes #123 -->

## Type
- [ ] feat · [ ] fix · [ ] docs · [ ] test · [ ] refactor · [ ] perf · [ ] ci/build · [ ] security

## How it was tested
- [ ] `cd backend && npm test`
- [ ] `cd frontend && npm test && npm run build`
- [ ] `cd e2e && npx playwright test` (visual baselines updated only for **intended** UI changes)
- [ ] `docs/openapi.json` updated for API changes

## UI changes
<!-- Before/after screenshots. Confirm: no new axe violations, AA contrast, responsive at 320/375/768/1440. -->

## Security and secrets checklist
- [ ] No keys, tokens, passwords, `.env` files, database files or screenshots containing them
- [ ] New write paths are covered by the closed-by-default auth tests
- [ ] Inputs validated; SQL parameterised; errors leak no internals

## Docs
- [ ] README / CONTEXT / CHANGELOG updated where behaviour or status changed
