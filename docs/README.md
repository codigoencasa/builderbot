# BuilderBot repository documentation

Use [builderbot.app](https://www.builderbot.app/) for the public API, flows, providers and deployment.
The [AI-agent index](https://www.builderbot.app/llms.txt) points to the official documentation corpus.
This directory contains maintainer material, not the website source.

## Start here

| Goal | Guide |
| --- | --- |
| Create a bot | [Quickstart](https://www.builderbot.app/en/quickstart), [CLI selections](../packages/create-builderbot/README.md) |
| Contribute or run tests | [CONTRIBUTING](../CONTRIBUTING.md), [AGENTS](../AGENTS.md) |
| Work on the scaffolder | [CLI](../packages/cli/README.md), template workflow below |
| Review documentation alignment | [Audit and website follow-ups](audits/documentation-alignment.md) |
| Review historical decisions | [RFCs](rfc/), [audits](audits/) — dated evidence, not current API guarantees |

## Template workflow

`starters/apps/**` is generated. The source of truth is:

- `scripts/generate/template/{ts,js}` — shared source, scripts and README files.
- `scripts/generate/zones/providers` and `zones/databases` — imports, configuration and dependencies.
- `scripts/generate/zones/docker` — provider/language Dockerfiles; these replace the base Dockerfile.
- `scripts/generate/zones/extras/<provider>` — optional README, `env.example` (copied as `.env.example`) and package metadata overrides.

Provider README overrides replace the shared README; update both when shared guidance changes.
Supported combinations come from `packages/cli/src/configuration/index.ts`, including the Gupshup TS + Memory restriction.

```bash
pnpm run generate.templates
pnpm --filter @builderbot/cli test
# Review and commit generator sources AND starters/apps changes together.
pnpm run generate:check
```

`generate:check` regenerates and checks Git status, so it passes only after the generated files are committed.
The CLI/create-builderbot builds bundle these committed starters. Do not edit the bundle or copy examples directly into generated files.

## Runtime baseline

The scaffolder requires Node.js 20+ and Git. Use Node.js 22 and pnpm 9 for monorepo development to match CI.
The root/core engine ranges still allow some Node 18 versions; they are not the scaffolder's minimum.
Check each provider's requirements before deployment; a starter does not provision databases, tokens or public webhooks.
