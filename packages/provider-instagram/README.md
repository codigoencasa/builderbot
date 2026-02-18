<p align="center">
  <a href="https://builderbot.app/">
    <picture>
      <img src="https://builderbot.app/assets/thumbnail-vector.png" height="80">
    </picture>
    <h2 align="center">BuilderBot</h2>
  </a>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/provider-instagram">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/provider-instagram?color=%2300c200&label=%40builderbot%2Fprovider-instagram">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>

## Instagram Provider

This provider allows you to connect your BuilderBot chatbot with Instagram Direct Messages.

## Installation

```bash
npm install @builderbot/provider-instagram
```

## Configuration

Before using this provider, you need to:

1. Create a Facebook App at [Facebook Developers](https://developers.facebook.com/)
2. Add the Instagram product to your app
3. Connect your Instagram Business or Creator account
4. Generate an Access Token
5. Set up a webhook with your verify token

## Usage

```typescript
import { createBot, createProvider, createFlow } from '@builderbot/bot'
import { InstagramProvider } from '@builderbot/provider-instagram'

const main = async () => {
    const provider = createProvider(InstagramProvider, {
        accessToken: 'YOUR_ACCESS_TOKEN',
        igAccountId: 'YOUR_INSTAGRAM_ACCOUNT_ID',
        verifyToken: 'YOUR_VERIFY_TOKEN',
        version: 'v19.0', // optional, defaults to v19.0
        port: 3000, // optional, defaults to 3000
    })

    await createBot({
        flow: createFlow([]),
        provider,
        database: // your database adapter
    })
}

main()
```

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `accessToken` | string | Yes | - | Your Instagram/Facebook Access Token |
| `igAccountId` | string | Yes | - | Your Instagram Business Account ID |
| `verifyToken` | string | Yes | - | The verify token you set in Facebook webhook settings |
| `version` | string | No | `v19.0` | Facebook Graph API version |
| `port` | number | No | `3000` | Port for the webhook server |
| `name` | string | No | `instagram-bot` | Name identifier for the bot |

## Webhook Setup

1. In your Facebook App dashboard, go to Instagram > Settings
2. Add a webhook URL: `https://your-domain.com/webhook`
3. Enter your verify token
4. Subscribe to the following events:
   - `messages`
   - `messaging_postbacks`

## Available Methods

### sendMessage(userId, message, options?)
Send a text message to a user.

### sendImage(userId, imageUrl)
Send an image attachment.

### sendVideo(userId, videoUrl)
Send a video attachment.

### sendAudio(userId, audioUrl)
Send an audio attachment.

### sendFile(userId, fileUrl)
Send a file attachment.

### sendQuickReplies(userId, text, quickReplies)
Send quick reply buttons.

```typescript
await provider.sendQuickReplies('user_id', 'Quick options:', [
    { content_type: 'text', title: 'Yes', payload: 'YES' },
    { content_type: 'text', title: 'No', payload: 'NO' }
])
```

### saveFile(ctx, options?)
Save a file from a received message.

## Supported Events

The provider handles the following incoming events:

- **Text messages**: Regular text messages from users
- **Image attachments**: Images sent by users
- **Video attachments**: Videos sent by users  
- **Audio attachments**: Audio files and voice notes
- **File attachments**: Documents and other files
- **Postback events**: Button click responses

## Documentation

Visit [builderbot.app](https://builderbot.app/) to view the full documentation.

## Official Course

If you want to discover all the functions and features offered by the library you can take the course.
[View Course](https://app.codigoencasa.com/courses/builderbot?refCode=LEIFER)

## Contact Us
- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)

