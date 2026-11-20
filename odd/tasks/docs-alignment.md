# Documentation alignment
Align repository and starter documentation with builderbot.app; website edits are outside this repository.
Base: `5626e593` (`builderbot`); tracker: `docs/align-guides-and-starters`; delivery: `feature-branch-chain`; checks: Markdown readback, generator check, CLI UVU.

## Specs
S1. "revisar donde quedamos y adutiar los cambios, quiero mejorar la documentacion en todos lados, revisar documentacion revisar templates y asegura que este alineado con nuestro sitio web builderbot.app"
S2. "ok asegurate de commitear todo y lanzar pr par aluego hacer le merge"
S3. Delivery selection: "Cadena sobre una rama de documentación". Scope statement: "No voy a modificar runtime, dependencias ni Dockerfiles."

## Tasks
T1 | S1 | inline (background writers disabled; no parallel writer reason) | in_progress | Align entry-point/contributor/agent docs and add an audit/index; commit: pending.
T2 | S1 | inline | pending | Replace generic starter README sources, preserve provider overrides, regenerate all starters; commit: pending.
T3 | S1-S3 | inline | pending | Run structural and generation/CLI checks; record results and commit evidence; commit: pending.
T4 | S2-S3 | inline | pending | Push tracker and two child branches; open draft tracker plus ordered child PRs, without merge; commit: pending.

## Log
L1. User: "revisar donde quedamos y adutiar los cambios, quiero mejorar la documentacion en todos lados, revisar documentacion revisar templates y asegura que este alineado con nuestro sitio web builderbot.app"
L2. User: "ok asegurate de commitear todo y lanzar pr par aluego hacer le merge"
L3. User selected `feature-branch-chain` after a forecast of 450–550 authored changed lines plus generated README copies. Two cohesive slices: repository guides, then generated starter guides. Tracker remains draft/no-merge. Generated copies cannot be split from their source changes.
L4. PR1295 merged on 2026-11-18 with Tests and Templates in sync green. Fresh `origin/builderbot` is 5626e593 (release 1.5.2), not the stale local PR branch. Repository initially clean. Node v24.19.0, pnpm 9.0.6. RDD reads on; assess each completed work-unit candidate. No runtime/dependency/container changes planned.
L5. Website source is not present here. Confirmed website follow-ups: quickstart JavaScript imports BaileysProvider from the core instead of provider-baileys; databases page uses names different from adapter exports. Do not copy those errors into local docs or claim the site is fixed. Explorer counts corrected: 16 active CLI providers, six databases, 181 starters, Gupshup TS+memory only.
L6. Passive documentation has no meaningful behavioral RED; validate commands/imports against sources, local links, README overlays, generated-file scope, generator consistency and existing CLI tests. Never install starter dependencies or invoke real providers/credentials during verification.
L7. T1 structural check passed (exit 0): local Markdown targets, all 16 CLI providers, six databases and TS/JS scripts; `git diff --check` passed. Initial native assessment could not classify untracked Markdown without declaration; recorded as unassessable, not approval. One independent read-only verifier is required at feature end before delivery. Runtime, manifests and lockfile remain unchanged.
