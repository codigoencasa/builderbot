# Documentation alignment
Align repository and starter documentation with builderbot.app; website edits are outside this repository.
Base: `5626e593` (`builderbot`); tracker: `docs/align-guides-and-starters`; delivery: `feature-branch-chain`; checks: Markdown readback, generator check, CLI UVU.

## Specs
S1. "revisar donde quedamos y adutiar los cambios, quiero mejorar la documentacion en todos lados, revisar documentacion revisar templates y asegura que este alineado con nuestro sitio web builderbot.app"
S2. "ok asegurate de commitear todo y lanzar pr par aluego hacer le merge"
S3. Delivery selection: "Cadena sobre una rama de documentación". Scope statement: "No voy a modificar runtime, dependencias ni Dockerfiles."

## Tasks
T1 | S1 | inline (background writers disabled; no parallel writer reason) | done | Repository/scaffolder guides + index/audit; structural check passed; commit: 9c5c461f.
T2 | S1 | inline | in_progress | Replace generic starter README sources, preserve provider overrides, regenerate all starters; commit: pending.
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
L8. Tracker seed e1f9c6a7; T1 commit 9c5c461f (245 changed lines). Child1 docs/repository-guides bases on docs/align-guides-and-starters; child2 docs/starter-guides bases on child1. T2 also corrects provider README overrides (environment is not auto-loaded, standalone TikTok instructions and TS-only build distinction).
L9. T2 self-checks passed (exit 0): `pnpm run generate.templates`, README/source parity for all 181 starters, Markdown-only diff, `git diff --check`, focused starters-banner UVU 3/3, full CLI UVU 16/16. No live provider or secret used. Shared READMEs and all three overrides point to llms.txt. Generated-only volume remains in the same commit as its sources.
