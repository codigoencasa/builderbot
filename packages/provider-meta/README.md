<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-meta</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## Link Preview (preview_url)

When sending text messages that contain a URL (`https://` or `http://`), WhatsApp can display a rich link preview. This provider enables it automatically.

### Auto-detection

If your message text contains a URL, `preview_url` is set to `true` automatically — no extra configuration needed:

```ts
await provider.sendText('+1234567890', 'Check https://example.com')
// preview_url = true (auto-detected)
```

This also works with `flowDynamic` — the auto-detection applies:

```ts
await flowDynamic('Visit https://example.com for details')
// preview_url = true (auto-detected)
```

### Explicit control

Use `sendMessage` options to override the auto-detection:

```ts
// Force preview ON (even without URL)
await provider.sendMessage('+1234567890', 'Hello', { preview_url: true })

// Force preview OFF (even with URL)
await provider.sendMessage('+1234567890', 'See https://example.com', { preview_url: false })
```

Or use `sendText` directly:

```ts
await provider.sendText('+1234567890', 'See https://example.com', null, false)
```


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)