# Research: TikTok Provider for BuilderBot

## Summary

This document investigates the feasibility of creating a TikTok provider for BuilderBot.

## Available TikTok APIs for Messaging

### 1. TikTok Business Messaging API (Official - Open Beta)

- **Type**: Webhook-based (HTTP POST), similar to the existing `provider-meta` and `provider-instagram`
- **Capabilities**: Receive and respond to TikTok Direct Messages programmatically, automate FAQ responses, send text messages, set welcome messages
- **Requirements**: TikTok Business Account + API approval
- **Model**: User must initiate conversation first (no outbound messaging)
- **Constraints**:
  - 48-hour messaging window after receiving a message
  - Maximum 10 consecutive messages before user must respond again
  - 10 queries per second rate limit
  - No broadcast/bulk messaging
  - Image attachments restricted in many regions
- **Regional Restriction**: **NOT available in the US, European Economic Area (EEA), Switzerland, or the United Kingdom**

### 2. TikTok Live Chat (Unofficial - Node.js)

- **Library**: [TikTok-Live-Connector](https://github.com/zerodytrash/TikTok-Live-Connector)
- **Type**: WebSocket-based (similar to `provider-baileys`)
- **Capabilities**: Read live stream comments, gifts, follows, shares + send messages to live chat (v2.0.2+)
- **Requirements**: Just `@username` to read; credentials to write
- **Risk**: High — reverse-engineered, may break at any time, possible TOS violation
- **Scope**: Live stream chat only, NOT direct messages

### 3. Third-Party Messaging Partners

Official TikTok Messaging Partners that abstract the Business Messaging API:
- respond.io
- SleekFlow
- SendPulse
- ChatBotKit
- UIB
- MessageGate

These could serve as middleware for a provider implementation.

## Architecture Compatibility

BuilderBot's provider architecture supports three message reception patterns:
1. **WebSocket/Events** (Baileys, Telegram, Venom)
2. **Webhooks** (Meta, Instagram, Evolution API)
3. **Polling** (Email via IMAP)

The TikTok Business Messaging API fits the **webhook pattern** (option 2), making it architecturally compatible with existing providers like `provider-meta` and `provider-instagram`.

A provider would need to implement:
- `initVendor()` — Initialize TikTok API client
- `sendMessage()` — Send text/media via Business Messaging API
- `saveFile()` — Download and save media from incoming messages
- `busEvents()` — Map TikTok webhook events to BuilderBot events
- `beforeHttpServerInit()` — Set up webhook endpoint routes (GET for verification, POST for incoming messages)

## Feasibility Assessment

| Approach | Feasibility | Risk | Notes |
|---|---|---|---|
| Business Messaging API (DMs) | Possible but region-locked | Low (official) | Not available in US/EU/UK |
| TikTok Live Chat Bot | Possible | High (unofficial) | Only for live streams, not DMs |
| DMs via personal/creator accounts | Not possible | N/A | No API exists |
| Via Messaging Partners | Possible | Low | Adds dependency on third-party |

## Conclusion

A TikTok DM provider is **technically feasible** using the official Business Messaging API (webhook model, similar to Meta/Instagram providers). However, the **regional restriction** (unavailable in US, EU, UK) makes it impractical for most users today.

For TikTok Live Chat, the unofficial Node.js library `TikTok-Live-Connector` could power a live-stream chatbot provider, but it carries significant stability and compliance risks.

**Recommendation**: Monitor TikTok's Business Messaging API for expanded regional availability before investing in a full provider implementation. The API is still in Open Beta and restrictions may be relaxed over time.
