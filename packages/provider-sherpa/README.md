<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-sherpa</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## WhatsApp Web version

Leave `version` unset: the provider resolves it on every connection, in this order:

1. Manual version: `WA_VERSION` env var, then the `version` option.
2. The version recommended by the whaileys maintainers (`fetchLatestBaileysVersion`).
3. The live WhatsApp Web version (`fetchLatestWaWebVersion`).
4. A fallback version known to work with the pinned whaileys release.

Each lookup has a 5 s timeout, and `sherpa.log` records which source was used.
When WhatsApp rejects the version (`405 Connection Failure`), the provider reconnects
with the live WhatsApp Web version, skipping the manual one, up to 3 times.

**Manual fix.** If the 405 persists, copy the latest version from
<https://wppconnect.io/whatsapp-versions/> and pass it as is:

```ts
const adapterProvider = createProvider(Provider, { version: '2.3000.1054953954-alpha' })
```

or without touching code, in `.env`:

```env
WA_VERSION=2.3000.1054953954
```

Accepted formats: `[2, 3000, 1054953954]`, `'2.3000.1054953954'`, `'2.3000.1054953954-alpha'`,
`'2,3000,1054953954'`. Remove the manual version once a provider update fixes the issue:
a pinned version goes stale within weeks.


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
