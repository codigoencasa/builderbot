# Documentation alignment audit

Reviewed on 2026-11-20 against monorepo base `5626e593` (1.5.2) and the English pages below.
This is a documentation audit, not a certification of every provider, translation or deployment.
The approved Markdown was reapplied on clean `builderbot-dev` base `a9623ea2`; stable-only versions, tests and release changes were not imported. See the [dev release policy](../dev-release.md) for no-publish documentation PRs.
PR [#1295](https://github.com/codigoencasa/builderbot/pull/1295) already merged the agent-documentation banner and its regression test.

## Repository corrections

| Surface | Correction |
| --- | --- |
| Root and npm entry points | Explain prerequisites, supported CLI selections, generated directory names and TS/JS run commands. |
| Contributor and agent guides | Distinguish Node 20+ scaffolding from Node 22/pnpm 9 monorepo development; include Redis and remove stale test-script references. |
| Generated starter README sources | Explain configuration, environment loading, development/production and sample HTTP endpoints instead of scaffolding another project. |
| Provider README overrides | Keep provider-specific limitations; make setup usable outside the monorepo and avoid a JS build command that does not exist. |
| Documentation ownership | Link the official site, package guides and generator sources; identify website-side follow-ups explicitly. |

## Website follow-ups — still open

The website source is outside this monorepo. These items require a separate change in its repository; linking the site does not fix them.

| Page checked | Observed discrepancy | Repository evidence / required correction |
| --- | --- | --- |
| [Quickstart](https://www.builderbot.app/en/quickstart) | JavaScript example imports `BaileysProvider` from `@builderbot/bot`. | Import it from `@builderbot/provider-baileys`, as the TS example and `scripts/generate/zones/providers/baileys.json` do. |
| [Databases](https://www.builderbot.app/en/databases) | Examples use `MongoDB`, `MysqlDB`, `PostgreSQLDB`. | Current package exports are `MongoAdapter`, `MysqlAdapter`, `PostgreSQLAdapter`; see `packages/database-{mongo,mysql,postgres}/src/index.ts` and adapter files. |
| [Databases](https://www.builderbot.app/en/databases) | Redis is missing from the connector list. | `packages/database-redis/README.md` documents the shipped adapter; the CLI offers `redis`. Memory is `MemoryDB` from `@builderbot/bot`. |
| [Docker](https://www.builderbot.app/en/deploy/docker) | The displayed Dockerfile is not the provider/language-specific file generated here. | Reconcile the guide with `scripts/generate/zones/docker/`; do not replace working container recipes during a documentation-only change. |

## Boundaries and remaining work

- The [website templates gallery](https://www.builderbot.app/en/templates) contains use-case examples; it is not the CLI's provider/database/language matrix. The latter is `packages/cli/src/configuration/index.ts` (16 providers, six databases; Gupshup only TS + Memory).
- The [agent index](https://www.builderbot.app/llms.txt) is a discovery entry point, not a second implementation source of truth. Resolve discrepancies against the installed version and its exports.
- Provider-specific credentials and database literals still live in some generated entrypoints. README instructions do not add automatic `.env` loading or migrate literals to environment variables.
- Default chat flows still contain a legacy `https://builderbot.app/docs` message. Updating flow output requires a separate behavior change and regression check; this change only updates Markdown.
- ES/PT translations, every tutorial/API example, external link availability across all package READMEs, npm tarball contents, live messaging, credentials, databases and deployment were not exhaustively verified.

## Maintenance checklist

1. Change shared docs in `scripts/generate/template/{ts,js}` and provider overrides in `scripts/generate/zones/extras`.
2. Run `pnpm run generate.templates`; review and commit source and generated starters together.
3. Run `pnpm run generate:check` after committing. Run the CLI tests for scaffold changes.
4. Keep website issues separate until their repository and updated pages are verified. See the [documentation index](../README.md).
