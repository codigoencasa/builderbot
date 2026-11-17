<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/provider-twilio</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## Receiving media safely

`saveFile(ctx, options)` accepts only HTTPS media URLs on `api.twilio.com`, using the default HTTPS port
and no URL username/password. It returns `'ERROR'` for invalid, local, non-Twilio or failed downloads.
Twilio account credentials are attached only after this validation. Arbitrary external media URLs are not supported.
The shared downloader does not follow HTTP redirects.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)