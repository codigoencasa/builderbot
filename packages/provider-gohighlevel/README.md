# @builderbot/provider-gohighlevel

GoHighLevel provider for BuilderBot - Supports SMS, WhatsApp, Email, Live Chat, Facebook, Instagram and Custom channels via GHL API v2.

## Supported Channels

| Channel | Type |
|---------|------|
| SMS | `SMS` |
| WhatsApp | `WhatsApp` |
| Email | `Email` |
| Live Chat | `Live_Chat` |
| Facebook | `Facebook` |
| Instagram | `Instagram` |
| Custom | `Custom` |

## Installation

```bash
pnpm add @builderbot/provider-gohighlevel
# or
npm install @builderbot/provider-gohighlevel
```

## Prerequisites - GoHighLevel Configuration

Before using this provider, you need to configure your GoHighLevel App in the Marketplace.

### Step 1: Create App in GHL Marketplace

1. Go to [GHL Marketplace](https://marketplace.gohighlevel.com)
2. Click on **"Create App"**
3. Fill in the app details:
   - App Name
   - Description
   - App Type: **Private** (for your own use) or **Public**

### Step 2: Configure OAuth2 Scopes

In your app settings, enable the following scopes:

```
conversations.message.readonly
conversations.message.write
contacts.readonly
contacts.write
```

### Step 3: Get Client Credentials

After creating the app, you'll receive:
- **Client ID** - Your OAuth2 client identifier
- **Client Secret** - Your OAuth2 client secret (keep this secure!)

### Step 4: Configure Redirect URI

Set your Redirect URI to point to your server's OAuth callback endpoint:

```
https://your-domain.com/oauth/callback
```

For local development:
```
http://localhost:3000/oauth/callback
```

### Step 5: Get Location ID

1. Go to your GoHighLevel sub-account
2. Navigate to **Settings > Business Profile**
3. Copy the **Location ID** (also visible in the URL)

Alternatively, find it in the URL when logged into a sub-account:
```
https://app.gohighlevel.com/v2/location/YOUR_LOCATION_ID/...
```

## Environment Variables

Create a `.env` file with your credentials:

```env
# Required
GHL_CLIENT_ID=your_client_id_here
GHL_CLIENT_SECRET=your_client_secret_here
GHL_LOCATION_ID=your_location_id_here

# Optional
GHL_REDIRECT_URI=http://localhost:3000/oauth/callback
GHL_WEBHOOK_SECRET=your_webhook_secret_for_hmac_verification
GHL_CHANNEL_TYPE=WhatsApp
```

## Basic Usage

### Minimal Setup

```typescript
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { GoHighLevelProvider } from '@builderbot/provider-gohighlevel'
import { MemoryDB } from '@builderbot/bot'

// Create the provider
const provider = createProvider(GoHighLevelProvider, {
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    locationId: process.env.GHL_LOCATION_ID,
    channelType: 'WhatsApp',
    redirectUri: process.env.GHL_REDIRECT_URI,
})

// Create a simple flow
const welcomeFlow = addKeyword(['hello', 'hi'])
    .addAnswer('Welcome! How can I help you today?')

// Create and start the bot
const main = async () => {
    await createBot({
        flow: createFlow([welcomeFlow]),
        provider,
        database: new MemoryDB(),
    })

    console.log('Bot is running!')
}

main()
```

### With Webhook Signature Verification (Recommended for Production)

```typescript
const provider = createProvider(GoHighLevelProvider, {
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    locationId: process.env.GHL_LOCATION_ID,
    channelType: 'WhatsApp',
    redirectUri: process.env.GHL_REDIRECT_URI,
    webhookSecret: process.env.GHL_WEBHOOK_SECRET, // HMAC SHA256 verification
})
```

### With Pre-existing Tokens

If you already have access tokens (e.g., from a previous session):

```typescript
const provider = createProvider(GoHighLevelProvider, {
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    locationId: process.env.GHL_LOCATION_ID,
    channelType: 'WhatsApp',
    accessToken: 'your_existing_access_token',
    refreshToken: 'your_existing_refresh_token',
})
```

## Webhook Configuration in GoHighLevel

### Step 1: Get Your Webhook URL

Once your bot is running, your webhook URL will be:

```
https://your-domain.com/webhook
```

For local development with ngrok:
```bash
ngrok http 3000
# Use the ngrok URL: https://abc123.ngrok.io/webhook
```

### Step 2: Configure Webhook in GHL

1. Go to **Settings > Integrations > Webhooks** in your GHL sub-account
2. Click **"Add Webhook"**
3. Configure:
   - **Webhook URL**: `https://your-domain.com/webhook`
   - **Events**: Select `InboundMessage`
4. (Optional) Set a **Webhook Secret** for HMAC verification

### Step 3: Verify Webhook is Working

Send a test message to your GHL number/channel. You should see the bot respond.

## OAuth2 Authorization Flow

```
+--------+                               +---------------+
|        |---(1) Authorization Request-->|   GHL OAuth   |
|  User  |                               |    Server     |
|        |<--(2) Authorization Code------|               |
+--------+                               +---------------+
    |                                           |
    |                                           |
    v                                           v
+--------+                               +---------------+
|        |---(3) Exchange Code---------->|   GHL OAuth   |
|  Bot   |                               |    Server     |
| Server |<--(4) Access + Refresh Token--|               |
+--------+                               +---------------+
    |
    | (5) Auto-refresh before expiry
    v
```

### First-Time Authorization

1. Start your bot server
2. If no valid token exists, the provider will emit a `notice` event with the authorization URL
3. Visit the URL and authorize the app
4. GHL redirects to `/oauth/callback` with an authorization code
5. The provider exchanges the code for access/refresh tokens
6. Tokens are automatically refreshed 5 minutes before expiry

## Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `clientId` | string | Yes | - | OAuth2 Client ID from GHL Marketplace |
| `clientSecret` | string | Yes | - | OAuth2 Client Secret from GHL Marketplace |
| `locationId` | string | Yes | - | GHL Location/Sub-account ID |
| `channelType` | string | No | `'SMS'` | Channel type: SMS, WhatsApp, Email, Live_Chat, Facebook, Instagram, Custom |
| `redirectUri` | string | No | - | OAuth2 callback URL |
| `webhookSecret` | string | No | - | Secret for HMAC SHA256 webhook verification |
| `accessToken` | string | No | - | Pre-existing access token |
| `refreshToken` | string | No | - | Pre-existing refresh token |
| `conversationProviderId` | string | No | - | Custom conversation provider ID |
| `port` | number | No | `3000` | HTTP server port |
| `apiVersion` | string | No | `'2021-07-28'` | GHL API version |

## Exposed Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check - returns "running ok" |
| GET | `/oauth/callback` | OAuth2 authorization callback |
| POST | `/webhook` | Incoming messages from GHL |

## Handling Files/Media

### Saving Received Files

```typescript
const mediaFlow = addKeyword(['_event_media_'])
    .addAction(async (ctx, { provider }) => {
        // Save the received file
        const filePath = await provider.saveFile(ctx, { 
            path: './downloads' 
        })
        
        console.log('File saved to:', filePath)
    })
```

### Sending Media

```typescript
const sendMediaFlow = addKeyword('send photo')
    .addAnswer('Here is your image!', {
        media: 'https://example.com/image.jpg'
    })
```

### Sending Local Files

```typescript
const sendLocalFile = addKeyword('send document')
    .addAnswer('Here is the document!', {
        media: './files/document.pdf'
    })
```

## Provider Events

Listen to provider events for monitoring and debugging:

```typescript
provider.on('ready', () => {
    console.log('Provider is ready and connected!')
})

provider.on('message', (ctx) => {
    console.log('Message received:', ctx.body, 'from:', ctx.from)
})

provider.on('auth_failure', (payload) => {
    console.error('Authentication failed:', payload)
})

provider.on('notice', ({ title, instructions }) => {
    console.log(`[${title}]`, instructions.join('\n'))
})

provider.on('tokens_updated', (tokens) => {
    // Optionally persist tokens for later use
    console.log('Tokens updated, new expiry:', tokens.expires_in)
})
```

## Sending Messages Programmatically

```typescript
// Send text message
await provider.sendMessage('contact_phone_number', 'Hello!')

// Send with buttons (rendered as numbered list)
await provider.sendMessage('contact_phone_number', 'Choose an option:', {
    buttons: [
        { body: 'Option 1' },
        { body: 'Option 2' },
        { body: 'Option 3' },
    ]
})

// Send media
await provider.sendMessage('contact_phone_number', 'Check this out!', {
    media: 'https://example.com/image.png'
})
```

## Troubleshooting

### Error: "clientId and clientSecret are required"

**Cause**: Missing OAuth2 credentials.

**Solution**: Ensure you've set `GHL_CLIENT_ID` and `GHL_CLIENT_SECRET` environment variables.

### Error: "locationId is required"

**Cause**: Missing GHL sub-account location ID.

**Solution**: Set the `GHL_LOCATION_ID` environment variable with your sub-account's location ID.

### Error: "Contact not found for phone: XXX"

**Cause**: The phone number doesn't exist as a contact in GHL.

**Solution**: 
1. Ensure the contact exists in your GHL sub-account
2. Check the phone number format (should be digits only, e.g., `1234567890`)

### Error: "Invalid webhook signature"

**Cause**: Webhook signature verification failed.

**Solution**:
1. Ensure `webhookSecret` matches the secret configured in GHL
2. Check that the webhook is sending the signature in the correct header

### Error: "Missing webhook signature"

**Cause**: Webhook secret is configured but GHL isn't sending a signature.

**Solution**:
1. Configure the webhook secret in GHL's webhook settings
2. Or remove `webhookSecret` from your provider config if you don't need verification

### Authorization URL Not Working

**Cause**: Incorrect redirect URI configuration.

**Solution**:
1. Ensure `redirectUri` matches exactly what's configured in GHL Marketplace
2. For local development, use `http://localhost:PORT/oauth/callback`

## Complete Example

```typescript
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { GoHighLevelProvider } from '@builderbot/provider-gohighlevel'
import { MemoryDB } from '@builderbot/bot'

// Environment variables
const config = {
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    locationId: process.env.GHL_LOCATION_ID,
    channelType: 'WhatsApp' as const,
    redirectUri: process.env.GHL_REDIRECT_URI,
    webhookSecret: process.env.GHL_WEBHOOK_SECRET,
    port: 3000,
}

// Create provider
const provider = createProvider(GoHighLevelProvider, config)

// Flows
const welcomeFlow = addKeyword(['hello', 'hi', 'hola'])
    .addAnswer('Welcome to our service!')
    .addAnswer('How can I help you today?', {
        buttons: [
            { body: 'Sales' },
            { body: 'Support' },
            { body: 'Information' },
        ]
    })

const salesFlow = addKeyword(['sales', '1'])
    .addAnswer('Our sales team will contact you shortly!')

const supportFlow = addKeyword(['support', '2'])
    .addAnswer('Please describe your issue and we will help you.')

const mediaFlow = addKeyword([EVENTS.MEDIA])
    .addAction(async (ctx, { provider, flowDynamic }) => {
        const filePath = await provider.saveFile(ctx, { path: './uploads' })
        await flowDynamic(`File received and saved: ${filePath}`)
    })

// Main
const main = async () => {
    const bot = await createBot({
        flow: createFlow([welcomeFlow, salesFlow, supportFlow, mediaFlow]),
        provider,
        database: new MemoryDB(),
    })

    // Event listeners
    provider.on('ready', () => {
        console.log('GoHighLevel bot is ready!')
    })

    provider.on('notice', ({ title, instructions }) => {
        console.log(`[${title}]`)
        instructions.forEach(i => console.log(`  - ${i}`))
    })

    console.log(`Server running on port ${config.port}`)
}

main().catch(console.error)
```

## Useful Links

- [GoHighLevel API Documentation](https://highlevel.stoplight.io/docs/integrations)
- [GHL Marketplace](https://marketplace.gohighlevel.com)
- [BuilderBot Documentation](https://builderbot.app)
- [BuilderBot GitHub](https://github.com/codigoencasa/builderbot)

## License

ISC
