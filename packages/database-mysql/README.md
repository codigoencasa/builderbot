<p align="center">
  <a href="https://builderbot.app/">
    <h2 align="center">@builderbot/database-mysql</h2>
  </a>
</p>


## Documentation

Visit [builderbot](https://builderbot.app/) to view the full documentation.


## History lookup safety

`getPrevByNumber(from)` binds the sender as a SQL parameter, including senders containing quotes.
It returns the latest history row with parsed options, or `{}` when there is no history.
Database query failures reject the returned promise without continuing to read a missing result set.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)


## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)