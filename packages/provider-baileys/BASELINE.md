# `provider-baileys` — Baseline (Fase 0)

Snapshot congelado antes del hardening descrito en
[RFC 0002](../../docs/rfc/0002-provider-baileys-hardening.md).

| Métrica | Valor |
|---|---|
| Paquete | `@builderbot/provider-baileys@1.4.3-y.12` |
| Commit base | `accb3ec3` |
| `baileys` | `7.0.0-rc13` |
| `pnpm-lock.yaml` (sha256, 16) | `5235b1c1abbf3624` |
| Tests | **175 passed / 175 total** (5 suites) |
| `dist/` | 1.9 MB |
| `packages/provider-baileys/node_modules` | 264 KB |
| Sesiones residuales de test | 550 dirs `*_sessions` (gitignored) |

## Comandos de referencia

```bash
pnpm --filter @builderbot/provider-baileys test
pnpm --filter @builderbot/provider-baileys build
pnpm lint:check
pnpm format:check
```

## Tests que consagran comportamiento incorrecto

Estos tests afirman el comportamiento actual aunque contradiga el contrato de
Baileys. Se marcan con `// BUG(H<n>)` y se corrigen en fases posteriores.

| Test | Marca | Fase que lo corrige |
|---|---|---|
| `#getMessage > should return empty message object` | `BUG(H3)` | Fase 2 |

## Ruido local de los tests

Los tests crean directorios `<name>_sessions` y ficheros `*.log` en el cwd del
paquete. Están cubiertos por `.gitignore` (líneas 35 y 74) pero se acumulan.
Desde Fase 0 se limpian automáticamente vía `jest.globalTeardown.ts`.
