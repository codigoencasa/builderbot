<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-baileys</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.

## Shutdown and session safety

By default, `captureProcessSignals` is `false`: the application owns its process
signals. Call `await provider.destroy()` in your shutdown handler. It cancels
pending reconnects, waits for initialization and socket shutdown, flushes the LID
cache and logs, and closes the provider HTTP server. Concurrent calls share the
same shutdown promise. A destroyed provider cannot be started again; create a
new instance instead.

Standalone applications may opt into `captureProcessSignals: true`. The provider
then handles shutdown signals and exits after its cleanup completes. Do not opt
in when another component owns process shutdown.

`releaseSessionFiles()` and `timeRelease` only remove regular files in the reserved
`builderbot-temp-<id>.tmp` namespace. They preserve credentials, Signal keys, LID
mappings, caches and all unknown files. Authentication files are **not temporary
files** and must not be deleted to reclaim disk space.

Tests use separate temporary workspaces; they never clean application sessions or logs.


## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)