# Project Instructions

> Complements `AGENTS.md` (the canonical agent guide for this repo). Read both.

## Tech Stack
- TypeScript monorepo (pnpm workspaces + Lerna + Nx cache), Node >=18 (use Node 22 + pnpm 9).
- Core lib: `@builderbot/bot` — flows, state machine, queue, provider interface.
- Providers: `packages/provider-*` (baileys, meta, twilio, telegram, voice, …).
- Databases: `packages/database-*` (json, mongo, mysql, postgres).
- Build: Rollup + `rollup-plugin-typescript2`. HTTP: Polka.
- Tests: UVU (`bot`, `cli`, `manager`, db pkgs) and Jest (most providers).
- Release: Lerna + standard-version + Conventional Commits.

## Code Style
- 4-space indent, single quotes, no semicolons, `es5` trailing commas, print width 120.
- Import order enforced: `[builtin+external]` → `internal` → `[parent+sibling+index]`, blank line between groups, case-insensitive alphabetical.
- Mixed file-naming conventions per package — follow local style. Classes PascalCase, vars/functions camelCase.
- Guard clauses and early returns; contextual log prefixes; HTTP layers return explicit status + JSON.
- Flow semantics (enforced by `eslint-plugin-builderbot`): `return gotoFlow/endFlow/fallBack`, `await flowDynamic`, `await state.update`; never mix `endFlow` + `flowDynamic`.

## Testing
- Run all: `pnpm test` · Coverage: `pnpm run test:coverage`
- Test dirs: `__tests__` (CLI uses `_test_`); files `*.test.ts` / `*.spec.ts`.
- UVU single file (anchor the regex): `pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/units "^state\\.test\\.ts$"`
- Jest single file: `pnpm --filter @builderbot/provider-gupshup exec jest __tests__/core.test.ts --runInBand`

## Build & Run
- Install: `pnpm install`
- Clean libs: `pnpm run clean.lib` · Build: `pnpm run build` · Full: `pnpm run build:full`
- Lint: `pnpm run lint:check` / `pnpm run lint:fix` · Format: `pnpm run format:check` / `format:write`
- Scaffold a bot: `pnpm run cli` · Commit: `pnpm commit`

## Project Structure
- `packages/bot/src/core/` — CoreClass engine (events, queue, state)
- `packages/bot/src/io/` — FlowClass + methods (addKeyword/addAnswer) + events
- `packages/bot/src/provider/interface/provider.ts` — abstract provider contract
- `packages/bot/src/types.ts` — public types (BotContext, TFlow, GeneralArgs)
- `packages/manager/` — multi-tenant REST manager (api.ts, bot-manager.ts, rate-limiter.ts)
- `packages/provider-*/`, `packages/database-*/` — adapters
- `starters/apps/` — generated templates · `base-ts-*-memory/` — runnable examples

## Conventions
- Conventional Commits (commitlint + commitizen); Husky hooks run on commit/push.
- Edit `src/**` only; never hand-edit generated `dist/**`.
- Add new providers by mirroring `packages/provider-baileys`.
- Verify the test runner (Jest vs UVU) before adding test commands.
- Known gotcha: `CONTRIBUTING.md` references `pnpm run test.e2e`, which is not defined at root.
