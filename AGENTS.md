# AGENTS.md
Guide for agentic coding tools working in this repository.

## Rule Files (Cursor/Copilot)
- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.
- `.cursor/commands/update-providers.md` exists, but it is a custom command doc, not a global rule file.

## Repository Snapshot
- Monorepo managed with `pnpm` + `lerna` (Nx cache configured in `nx.json`).
- Workspaces: `packages/*`.
- Main source: `packages/**/src`.
- Build artifacts: `packages/**/dist` (Rollup output).
- Package manager is enforced: `only-allow pnpm`.

## Templates / starters — MANDATORY RULE

`starters/apps/**` is **GENERATED**, never edited by hand:

- Source of truth: `scripts/generate/` (`template/{ts,js}` + `zones/{providers,databases,docker,extras}`).
- After **any** change under `scripts/generate/**`, you MUST run `pnpm run generate.templates`
  and commit the resulting `starters/apps/**` in the same change.
- Why: `create-builderbot` bundles `dist/starters` copied from `starters/apps` at build
  time, so forgetting the regeneration **publishes stale templates to npm**.
- Verify with `pnpm run generate:check` (regenerates and fails when `starters/apps`
  differs from what is committed). CI runs it on every alpha release.
- Curated examples must live in a zone (see `zones/providers/tiktok.json` +
  `zones/extras/tiktok/`), otherwise the generator overwrites them.

## Runtime Expectations
- Root engines: Node `>=18`, pnpm `>=8.6.12`.
- `CONTRIBUTING.md` recommends Node 20+.
- CI workflows use Node `22.20.0`.
- Safe default for agents: Node 22 + pnpm 9.

## Build / Lint / Test Commands
Run from repo root unless noted.

```bash
pnpm install
pnpm run clean.lib
pnpm run build
pnpm run build:full
pnpm run lint:check
pnpm run lint:fix
pnpm run format:check
pnpm run format:write
pnpm test
pnpm run test:coverage
```

Package-scoped commands:

```bash
pnpm --filter <package-name> build
pnpm --filter <package-name> test
pnpm --filter <package-name> test:coverage
```

Examples:

```bash
pnpm --filter @builderbot/bot build
pnpm --filter @builderbot/manager test
pnpm --filter @builderbot/provider-gupshup test
```

## Running A Single Test (Important)
This repo uses both Jest and UVU.

Jest single file:

```bash
pnpm --filter @builderbot/provider-gupshup exec jest __tests__/core.test.ts --runInBand
```

Jest single test case:

```bash
pnpm --filter @builderbot/provider-gupshup exec jest __tests__/core.test.ts -t "incomingMsg"
```

UVU single file (use directory + exact regex):

```bash
pnpm --filter @builderbot/manager exec uvu -r tsm ./__tests__ "^api\\.test\\.ts$"
pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/units "^state\\.test\\.ts$"
pnpm --filter @builderbot/cli exec uvu -r tsm ./_test_ "^check\\.test\\.ts$"
```

UVU gotcha:
- `pnpm --filter <pkg> test -- state.test.ts` may match multiple files by substring.
- Prefer narrowed directory + anchored regex for true single-file runs.

## Test Runner Map
- Jest packages: `@builderbot/provider-baileys`, `@builderbot/provider-email`, `@builderbot/provider-evolution-api`, `@builderbot/provider-facebook-messenger`, `@builderbot/provider-gohighlevel`, `@builderbot/provider-gupshup`, `@builderbot/provider-instagram`, `@builderbot/provider-meta`, `@builderbot/provider-sherpa`, `@builderbot/provider-telegram`, `@builderbot/provider-tiktok`, `@builderbot/provider-twilio`, `@builderbot/provider-venom`, `@builderbot/provider-voice`, `@builderbot/provider-voice-sip`, `@builderbot/provider-voice-whatsapp`, `@builderbot/provider-web-whatsapp`, `@builderbot/provider-wppconnect`.
- UVU packages: `@builderbot/bot`, `@builderbot/cli`, `@builderbot/manager`, `@builderbot/contexts-dialogflow`, `@builderbot/contexts-dialogflow-cx`, `@builderbot/database-json`, `@builderbot/database-mongo`, `@builderbot/database-mysql`, `@builderbot/database-postgres`, `eslint-plugin-builderbot`.
- No `test` script currently: `create-builderbot`.

## Code Style: Formatting and Imports
Source of truth: root `eslint.config.js` and `.prettierrc.json`.

- 4-space indentation.
- Single quotes.
- No semicolons.
- Trailing commas: `es5`.
- Print width: 120.
- Import ordering is enforced:
  - `builtin` + `external`
  - `internal`
  - `parent` + `sibling` + `index`
  - blank line between groups
  - alphabetical in each group (case-insensitive)

## Code Style: Types and Modules
- TypeScript is primary, but many packages compile with `allowJs: true`.
- Strict mode is not universally enabled; avoid assuming strict-only constraints.
- `any` is lint-allowed, but prefer explicit types for new code.
- Use `import type` for type-only imports when it improves clarity.
- Keep public exports typed in `src/index.ts`.
- Some packages use `~/*` path aliases (notably provider-meta); only use aliases already configured in that package.

## Code Style: Naming
- Follow local package conventions; do not force one naming style repo-wide.
- Existing file patterns include camelCase (`queueClass.ts`), kebab-case (`rate-limiter.ts`), and dotted names (`instagram.provider.ts`).
- Class/type names: PascalCase.
- Function/variable/method names: camelCase.
- Constants intended as true constants: UPPER_SNAKE_CASE.

## Error Handling Conventions
- Prefer guard clauses and early returns.
- API/HTTP layers should return explicit status codes + JSON payloads.
- Catch errors where you can recover or attach useful context.
- Log with contextual prefixes when practical (module/adapter/provider name).
- Avoid empty catches unless intentionally ignoring known-safe failures.

## BuilderBot Flow Conventions
When touching flow callbacks (or `eslint-plugin-builderbot` behavior), preserve these semantics:

- `return gotoFlow(...)`
- `return endFlow(...)`
- `return fallBack(...)`
- `await flowDynamic(...)`
- `await state.update(...)`
- Do not mix `endFlow` and `flowDynamic` in the same execution context.

## Testing Conventions
- Put tests in `__tests__` (CLI package uses `_test_`).
- Use `.test.ts` or `.spec.ts` according to local package style.
- UVU test files should call `test.run()`.
- Mock provider/network dependencies for unit tests.
- Keep tests deterministic and isolated.

## Agent Workflow
1. Identify affected package(s) and runner (Jest or UVU).
2. Edit `src/**`; avoid hand-editing generated `dist/**`.
2b. If you touched `scripts/generate/**`, run `pnpm run generate.templates` and commit `starters/apps/**`.
3. Run single-file tests first, then package-level tests.
4. Run lint/format checks for broad or cross-package changes.
5. Run `pnpm run build` for release-sensitive changes.

## Known Gotchas
- `CONTRIBUTING.md` references `pnpm run test.e2e`, but that script is not currently defined at root.
- Jest and UVU coexist; verify runner before writing automation/test commands.
