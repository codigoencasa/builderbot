# @builderbot/provider-email

Email provider for BuilderBot using IMAP/SMTP. Receive emails in real-time using IMAP IDLE and send emails via SMTP.

## Installation

```bash
npm install @builderbot/provider-email
# or
pnpm add @builderbot/provider-email
```

## Features

- Real-time email reception using IMAP IDLE
- Send emails via SMTP
- Thread/conversation tracking
- Attachment support (send and receive)
- Compatible with any IMAP/SMTP server (Gmail, Outlook, custom servers, etc.)

## Quick Start

```typescript
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { EmailProvider } from '@builderbot/provider-email'

const emailProvider = createProvider(EmailProvider, {
    imap: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-app-password'
        }
    },
    smtp: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-app-password'
        }
    }
})

const welcomeFlow = addKeyword(['hello', 'hi'])
    .addAnswer('Hello! I received your email.')
    .addAction(async (ctx, { provider }) => {
        console.log('Email from:', ctx.from)
        console.log('Subject:', ctx.subject)
        console.log('Body:', ctx.body)
        console.log('Is reply:', ctx.isReply)
    })

const main = async () => {
    await createBot({
        flow: createFlow([welcomeFlow]),
        provider: emailProvider,
        database: new MemoryDB()
    })
}

main()
```

## Configuration

### IEmailProviderArgs

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `imap` | `ImapConfig` | Yes | - | IMAP server configuration |
| `smtp` | `SmtpConfig` | Yes | - | SMTP server configuration |
| `mailbox` | `string` | No | `'INBOX'` | Mailbox to monitor |
| `markAsRead` | `boolean` | No | `true` | Mark emails as read after processing |
| `fromEmail` | `string` | No | SMTP user | From address for outgoing emails |
| `fromName` | `string` | No | - | Display name for outgoing emails |

### ImapConfig / SmtpConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `host` | `string` | Yes | Server hostname |
| `port` | `number` | Yes | Server port |
| `secure` | `boolean` | No | Use SSL/TLS (default: true) |
| `auth.user` | `string` | Yes | Username |
| `auth.pass` | `string` | Yes | Password or app password |

## Email Context (ctx)

When an email is received, the context object includes:

```typescript
interface EmailBotContext {
    from: string           // Sender's email address
    name: string           // Sender's display name
    body: string           // Email body (plain text)
    subject: string        // Email subject
    messageId: string      // Unique message ID
    threadId?: string      // Thread ID for conversations
    inReplyTo?: string     // ID of email being replied to
    isReply: boolean       // Whether this is a reply
    attachments?: Array<{
        filename: string
        contentType: string
        size: number
    }>
    html?: string          // HTML content (if available)
    to?: string[]          // Recipients
    cc?: string[]          // CC recipients
    date?: Date            // Email date
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

Get the thread ID for conversation tracking.

```typescript
const threadId = provider.getThreadId(ctx)
```

## Gmail Configuration

For Gmail, you need to use an App Password:

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use this password in the configuration

```typescript
{
    imap: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: 'your-email@gmail.com',
            pass: 'xxxx xxxx xxxx xxxx' // App password
        }
    },
    smtp: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'your-email@gmail.com',
            pass: 'xxxx xxxx xxxx xxxx' // App password
        }
    }
}
```

## Outlook/Office 365 Configuration

```typescript
{
    imap: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: {
            user: 'your-email@outlook.com',
            pass: 'your-password'
        }
    },
    smtp: {
        host: 'smtp.office365.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
            user: 'your-email@outlook.com',
            pass: 'your-password'
        }
    }
}
```

## License

MIT
