# Cobertura de PRs abiertos upstream — `codigoencasa/builderbot`

| Field | Value |
|---|---|
| Date | 2026-10-05 |
| Source | `gh pr list -R codigoencasa/builderbot --state open` (8 PRs) |
| Scope | Comparar los PRs abiertos con el trabajo local (`fix/baileys-*`, RFC 0001–0003) |
| Method | `gh pr view/diff/files` + verificación de ancestros con `git merge-base --is-ancestor` |

---

## 1. Re-análisis de estructura

### 1.1 Estructura del payload (dos capas)

Los proveedores comparten la **capa de eventos** (`_event_*_<uuid>`, mismo
`utils.generateRefProvider`) pero difieren en el **envelope de metadatos**:

| | Meta | Baileys |
|---|---|---|
| Forma | **plano** (13 claves en raíz) | **anidado + spread** (`key`, `message`) + alias planos |
| Identidad | `from`, `to`, `userId` | `key.remoteJid`, `key.participant`, `key.fromMe`, `key.id` |
| Contenido | campos planos (`caption`, `latitude`…) | `message.*` (estructura interna de Baileys) |
| Id / tiempo | `message_id`, `timestamp` | `key.id`, `messageTimestamp` |

Conclusión: la diferencia **no es solo de nombres de campo, es de forma**
(plano vs anidado). Un envelope común exige aplanar en Baileys y preservar el
raw en `raw` (ver RFC 0003).

### 1.2 Estructura de paquetes afectada

- 28 paquetes en `packages/*`.
- Nuestra cadena local toca **1 paquete** (`provider-baileys`) + docs.
- Los PRs abiertos tocan: `bot`, `provider-meta`, `provider-baileys`,
  `provider-venom`, `provider-wppconnect`, `database-redis`, CI.

## 2. Los 8 PRs abiertos y su cobertura

| PR | Título | Veredicto | Evidencia |
|---|---|---|---|
| **#1236** | Ensure bsuid is included and add tracking fields | ✅ **Ya superado por nuestro trabajo** | Incluye `feat(provider-baileys): integrate LID cache for phone number resolution` y `fix(provider-baileys): fallback @lid JID when remoteJidAlt is absent`. Nuestro `lidCache` con TTL real + `compact()` (`3ba777ef`) y el fallback `from=@lid` (`eeb557ce`, T3) cubren ambos. Su parte BSUID ya está en mainline (`425c4668`, `c4e5bb81`, ambos ancestros de `HEAD`). PR `CONFLICTING`/`DIRTY`. |
| **#1244** | Refactor printer + Redis state (+ meta username/BSUID) | 🟡 **Parte Meta ya cubierta y mejor**; Redis no es nuestro | La parte Meta (`from_user_id` → `recipient`) ya está en mainline vía `425c4668`/`c4e5bb81`. Nuestro `isBSUID` usa el regex documentado por Meta (`^[A-Z]{2}\.[A-Za-z0-9]+$`); su `isMetaUserId` usa una heurística (\"no son 10-15 dígitos\"), más frágil. Ya leemos `contact.profile.username` (`core.ts:306`). Único aporte suyo no cubierto: `pushName ?? profile.username`. |
| **#1259** | backlog: addKeyword, QR venom, sharp engines, meta webhook notice, endFlow, CI | 🟡 **Solo adyacente; no cubierto** | Su cambio en `provider-baileys/package.json` es `engines.node >= 20.12.1` (nosotros **no** tenemos `engines`). Su cambio en `provider-meta/src/meta/provider.ts` emite `notice` \"🔗 WEBHOOK REQUIRED\" al conectar (nuestro RFC 0001 cubre `message_status`, no ese aviso). Venom/bot/CI fuera de alcance. `MERGEABLE`/`UNSTABLE`. |
| **#1258** | fix(core): globalArg filter para auto-respuestas + try/catch en handleCtx | ❌ No implementado, **pero relacionado** | Nuestro RFC 0003 detectó que **`fromMe` falta en la raíz en AMBOS** proveedores (Meta lo declara y no lo asigna; Baileys lo tiene solo en `key.fromMe`). Exponerlo habilitaría el filtrado de auto-respuestas en core. `MERGEABLE`/`CLEAN`. |
| **#1245** | bump sharp 0.33.3 → 0.35.0 (provider-venom) | ❌ No es nuestro | En Baileys conservamos `sharp@0.33.3`; sí eliminamos deps muertas (`3ba777ef`). |
| **#1246** | bump sharp 0.33.5 → 0.35.0 (provider-wppconnect) | ❌ No es nuestro | — |
| **#1248** | bump nx 22.2.0 → 22.7.2 | ❌ Dependabot | — |
| **#1264** | bump nodemailer 6.10.1 → 10.0.9 | ❌ Dependabot | — |

Resumen: **1 PR superado (#1236)**, **2 parcialmente cubiertos (#1244 mejor que él, #1259 adyacente)**,
**1 relacionado con un hallazgo nuestro (#1258)**, **4 ajenos** (deps).

## 3. Qué podemos aprovechar de ellos (backlog)

1. **`engines` en `provider-baileys`** (de #1259): `{ "node": ">=20.12.1" }`.
   Es correcto: `sharp@0.33.3` lo exige. Coste: 1 línea.
2. **Aviso `notice` de webhook en Meta** (de #1259): mejora de DX real, encaja con RFC 0001.
3. **Exponer `fromMe` en la raíz** (de #1258 + hallazgo RFC 0003): desbloquea el
   filtrado de auto-respuestas en core sin tocar el core.
4. **`pushName ?? profile.username`** (de #1244): fallback de nombre cuando el
   contacto no tiene `profile.name` (usuarios solo-username).
5. **Añadir ref `_event_contacts_` y ref de poll en Baileys** (hallazgo propio, RFC 0003 §3.1).

## 4. No-objetivos

- No adoptar el patrón de ramas gigantes de #1236/#1244 (513 y 35 ficheros, ambos `CONFLICTING`).
- No tocar Redis, nx, nodemailer ni los bumps de sharp de otros proveedores.
