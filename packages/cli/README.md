# @builderbot/cli

The scaffolding engine used by `create-builderbot`. To create a bot, use the public entry point:

```bash
npm create builderbot@latest
# Or: pnpm create builderbot@latest
```

Requires **Node.js 20+** and **Git**. See the [quickstart](https://www.builderbot.app/en/quickstart) and
[create-builderbot options](../create-builderbot/README.md) for supported provider/database/language combinations.

## Work on the CLI in this monorepo

Use **Node.js 22** and **pnpm 9** to match CI. From the repository root:

```bash
pnpm install
pnpm --filter @builderbot/cli build
pnpm run cli
```

The CLI copies bundled starters, renames `_gitignore`, and sets BuilderBot dependency versions.
It creates `base-<language>-<provider>-<database>`; it does not install that project's dependencies.
The TypeScript next step is `npm run dev`, not `npm start` before building.

## Templates and checks

Never hand-edit `starters/apps/**` or bundled `dist` files. Edit `scripts/generate/template` and `scripts/generate/zones`,
then regenerate and commit the resulting starters. See the [template workflow](../../docs/README.md#template-workflow).

```bash
pnpm run generate.templates
pnpm --filter @builderbot/cli exec uvu -r tsm ./_test_ "^starters-banner\\.test\\.ts$"
pnpm --filter @builderbot/cli test
```

After committing the generated files, run `pnpm run generate:check`; it regenerates and requires a clean starter tree.
CLI tests use **UVU**, not Jest. `create-builderbot` currently has no test script of its own.

- [Official documentation](https://www.builderbot.app/).
- [AI-agent documentation index](https://www.builderbot.app/llms.txt).
- [Contributor guide](../../CONTRIBUTING.md).
