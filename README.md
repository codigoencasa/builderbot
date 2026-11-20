<p align="center">
  <a href="https://builderbot.app/">
    <picture>
      <img src="https://builderbot.app/assets/thumbnail-vector.png" height="80">
    </picture>
    <h2 align="center">BuilderBot</h2>
  </a>
</p>



<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/bot">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/bot?color=%2300c200&label=%40builderbot%2Fbot">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>


## Getting Started

With this library, you can build automated conversation flows agnostic to the WhatsApp provider, set up automated responses for frequently asked questions, receive and respond to messages automatically, and track interactions with customers. Additionally, you can easily set up triggers to expand functionalities limitlessly.

Use **Node.js 20 or newer** and **Git**, as described in the [official quickstart](https://www.builderbot.app/en/quickstart).

```bash
npm create builderbot@latest
# Or: pnpm create builderbot@latest
```

For a TypeScript + Baileys + Memory starter without the selection prompts:

```bash
npm create builderbot@latest -- --provider=baileys --database=memory --language=ts
cd base-ts-baileys-memory
npm install
npm run dev
```

Configure the selected provider before connecting. Follow the generated README for credentials and database setup.
For TypeScript production builds, run `npm run build` before `npm start`; JavaScript starters run with `npm start`.
See [create-builderbot](packages/create-builderbot/README.md) for supported options.


## Documentation

- [Official documentation](https://www.builderbot.app/) — public API, providers and deployment.
- [Documentation index for AI agents](https://www.builderbot.app/llms.txt) — read before answering or editing a bot.
- [Repository documentation](docs/README.md) — maintainer guides, template generation and audit findings.
- [Contributing](CONTRIBUTING.md) and [agent instructions](AGENTS.md) — local development and checks.


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)