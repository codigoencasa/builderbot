# @builderbot/provider-gmail

Gmail provider for BuilderBot using the Gmail API with OAuth2 authentication. Receive emails in real-time via polling and send emails through the Gmail API.

## Installation

```bash
npm install @builderbot/provider-gmail
# or
pnpm add @builderbot/provider-gmail
```

## Features

- Gmail API with OAuth2 authentication (no app passwords needed)
- Real-time email reception via polling with history tracking
- Send emails via Gmail API
- Native Gmail thread support
- Attachment support (send and receive via Gmail API)
- Automatic mark-as-read support

## Prerequisites

### Setting up Google Cloud OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API** in the API Library
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Set the application type to **Web application**
6. Add `http://localhost:3000` to Authorized redirect URIs
7. Copy the **Client ID** and **Client Secret**

### Obtaining a Refresh Token

Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) or implement your own authorization flow:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon and check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In Step 1, select `https://mail.google.com/` scope
5. Click "Authorize APIs" and sign in with your Gmail account
6. In Step 2, click "Exchange authorization code for tokens"
7. Copy the **Refresh Token**

## Quick Start

```typescript
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { GmailProvider } from '@builderbot/provider-gmail'

const gmailProvider = createProvider(GmailProvider, {
    email: 'your-email@gmail.com',
    oauth2: {
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET',
        refreshToken: 'YOUR_REFRESH_TOKEN'
    }
})

const welcomeFlow = addKeyword(['hello', 'hi'])
    .addAnswer('Hello! I received your email.')
    .addAction(async (ctx, { provider }) => {
        console.log('Email from:', ctx.from)
        console.log('Subject:', ctx.subject)
        console.log('Body:', ctx.body)
        console.log('Thread ID:', ctx.threadId)
        console.log('Is reply:', ctx.isReply)
    })

const main = async () => {
    await createBot({
        flow: createFlow([welcomeFlow]),
        provider: gmailProvider,
        database: new MemoryDB()
    })
}

main()
```

## Configuration

### IGmailProviderArgs

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `email` | `string` | Yes | - | Gmail account email address |
| `oauth2` | `GmailOAuth2Config` | Yes | - | OAuth2 credentials |
| `label` | `string` | No | `'INBOX'` | Gmail label to monitor |
| `markAsRead` | `boolean` | No | `true` | Mark emails as read after processing |
| `fromName` | `string` | No | - | Display name for outgoing emails |
| `messageSource` | `string` | No | `'body'` | Source for message: 'body', 'subject', or 'both' |
| `pollingInterval` | `number` | No | `10000` | Polling interval in ms |

### GmailOAuth2Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `clientId` | `string` | Yes | OAuth2 Client ID |
| `clientSecret` | `string` | Yes | OAuth2 Client Secret |
| `refreshToken` | `string` | Yes | OAuth2 Refresh Token |

## Email Context (ctx)

When an email is received, the context object includes:

```typescript
interface GmailBotContext {
    from: string           // Sender's email address
    name: string           // Sender's display name
    body: string           // Email body (plain text)
    subject: string        // Email subject
    messageId: string      // RFC Message-ID header
    threadId?: string      // Gmail Thread ID
    inReplyTo?: string     // ID of email being replied to
    isReply: boolean       // Whether this is a reply
    attachments?: Array<{
        filename: string
        contentType: string
        size: number
        attachmentId?: string
    }>
    html?: string          // HTML content (if available)
    to?: string[]          // Recipients
    cc?: string[]          // CC recipients
    date?: Date            // Email date
    gmailId?: string       // Gmail internal message ID
}
```

## API Methods

### sendMessage(to, message, options?)

Send an email to a recipient.

```typescript
await provider.sendMessage('recipient@example.com', 'Hello!', {
    subject: 'Greeting',
    html: '<h1>Hello!</h1>'
})
```

### sendMedia(to, message, mediaPath, options?)

Send an email with an attachment.

```typescript
await provider.sendMedia(
    'recipient@example.com',
    'Please find the document attached.',
    '/path/to/document.pdf',
    { subject: 'Document' }
)
```

### reply(ctx, message, options?)

Reply to an existing email thread.

```typescript
.addAction(async (ctx, { provider }) => {
    await provider.reply(ctx, 'Thank you for your message!')
})
```

### saveFile(ctx, options?)

Save an email attachment to disk.

```typescript
.addAction(async (ctx, { provider }) => {
    if (ctx.attachments?.length) {
        const filePath = await provider.saveFile(ctx, {
            path: './downloads',
            attachmentIndex: 0
        })
        console.log('Saved to:', filePath)
    }
})
```

### getAttachments(ctx)

Get all attachments from an email.

```typescript
const attachments = provider.getAttachments(ctx)
```

### isReply(ctx)

Check if the email is a reply.

```typescript
if (provider.isReply(ctx)) {
    console.log('This is a reply to:', ctx.inReplyTo)
}
```

### getThreadId(ctx)

Get the Gmail thread ID for conversation tracking.

```typescript
const threadId = provider.getThreadId(ctx)
```

## Gmail vs Email Provider

| Feature | Gmail Provider | Email Provider |
|---------|---------------|----------------|
| Authentication | OAuth2 | IMAP/SMTP credentials |
| Receiving | Gmail API polling | IMAP IDLE |
| Sending | Gmail API | SMTP |
| Thread tracking | Native Gmail threads | Message-ID references |
| Attachment download | Gmail API | IMAP fetch |
| Server compatibility | Gmail only | Any IMAP/SMTP server |

Use the **Gmail Provider** when you specifically need Gmail integration with OAuth2. Use the **Email Provider** when you need generic IMAP/SMTP support for any email server.

## License

MIT
