# base-js-tiktok-memory

Minimal BuilderBot example for **TikTok organic comments** (poll + public reply).

See the TypeScript twin for full docs: [`base-ts-tiktok-memory`](../base-ts-tiktok-memory/README.md).

```bash
export TIKTOK_ACCESS_TOKEN=...
export TIKTOK_BUSINESS_ID=...
export TIKTOK_VIDEO_IDS=7258231412594101531

pnpm --filter @builderbot/provider-tiktok build
cd starters/apps/base-js-tiktok-memory
pnpm install
pnpm start
```
