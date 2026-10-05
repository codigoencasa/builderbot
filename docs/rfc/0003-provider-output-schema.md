# RFC 0003 — Esquema de salida unificado para proveedores

| Field | Value |
|---|---|
| Status | **Draft** (pendiente de aprobación) |
| Author | Engineering (agent-assisted) |
| Provenance | Auditoría de `packages/provider-meta` vs `packages/provider-baileys` (2026-10-05) |
| Target version | `1.5.x` (aditivo; sin breaking en el core) |
| Risk | Bajo si es aditivo. Medio si se renombran campos existentes |
| Relacionado | RFC 0001 (`provider-meta` message_status), RFC 0002 (`provider-baileys`) |

---

## 1. Problema

Cada proveedor emite en el evento `message` una forma distinta. El código de flujo
que funciona con Meta no funciona igual con Baileys y viceversa:

```ts
// Meta
ctx.type        // 'text' | 'interactive' | 'button' | ...
ctx.message_id  // id
ctx.pushName    // nombre
ctx.username    // username (si existe)

// Baileys
ctx.type        // ❌ no existe
ctx.message_id  // ❌ no existe (está en ctx.key.id)
ctx.pushName    // ❌ no existe (solo ctx.name)
ctx.username    // ✅ (añadido hoy)
```

El core (`packages/bot/src`) solo consume `ctx.from` y `ctx.body`, por lo que unificar
el resto es **aditivo**: no rompe al framework, solo a consumidores que lean campos
concretos.

## 2. Diff verificado (payloads reales capturados el 2026-10-05)

> Metodología: se instanciaron ambos proveedores con mensajes sintéticos y se
> capturó **el objeto realmente emitido** en el evento `message` (no los tipos).
> Artefactos: `/tmp/provider-output-audit.json`, `/tmp/provider-output-audit2.json`.
> Casos: texto 1:1, texto con username/LID, grupo, imagen, vídeo, audio, documento,
> sticker, ubicación, contacto, orden, poll, botón y lista.

### 2.1 Presencia de campos

| Campo | `provider-baileys` | `provider-meta` |
|---|---|---|
| `from` | 14/14 | 14/14 |
| `body` | 12/14 (sin `body` en contacto y poll) | 14/14 |
| `name` | 14/14 | 14/14 |
| `pushName` | **14/14** ✅ (heredado del WAMessage, no del código propio) | 14/14 |
| `type` | **0/14** | 14/14 |
| `message_id` | 0/14 (está en `key.id`) | 14/14 |
| `timestamp` | 0/14 (está en `messageTimestamp`) | 14/14 |
| `to` | 0/14 | 14/14 |
| `fromMe` (nivel raíz) | **0/14** (solo `key.fromMe`) | **14/14** ✅ (`processIncomingMsg.ts:205` lo devuelve; `core.ts` pasa `message.fromMe ?? false`) |
| `username` | 1/14 (solo si WhatsApp lo envía) | 1/14 (solo si Meta lo envía) |
| `userId` | 0/14 (el LID vive en `key.remoteJid`) | 1/14 (BSUID) |
| `participant` / `sender` / `participantUsername` | 1/14 (solo grupos) | 0/14 |
| `key`, `message`, `messageTimestamp`, `broadcast` | ✅ (spread del `WAMessage`) | ❌ |
| `fileData`, `caption`, `latitude`, `longitude`, `order`, `contacts`, `payload`, `title_button_reply`, `title_list_reply`, `id_list_reply`, `nfm_reply`, `id` | ❌ | ✅ (según tipo) |
| `raw` | ❌ | ❌ |

### 2.2 Formato de valores

| Aspecto | Baileys | Meta |
|---|---|---|
| `from` | dígitos (`15551230000`), `@g.us`, o `@lid` | dígitos o **BSUID** (`US.xxx`) |
| `body` para media | `_event_media__<uuid>`, `_event_document__<uuid>`, `_event_voice_note__<uuid>`, `_event_location__<uuid>`, `_event_order__<uuid>` | **los mismos** (`utils.generateRefProvider`) ✅ |
| `timestamp` | segundos, en `messageTimestamp` | segundos, en `timestamp` |
| media | contenido crudo en `message.*` | `fileData` (se rellena al descargar) + campos planos |

### 2.3 Hallazgos que corrigen la primera lectura

1. **Baileys sí emite `pushName`** (14/14): llega por el spread del `WAMessage`.
   La conclusión inicial ("no existe") era incorrecta.
2. **`fromMe` solo falta en Baileys** (está en `key.fromMe`, no en la raíz).
   **Corrección a la primera lectura del audit:** Meta SÍ lo expone en la raíz
   (`processIncomingMsg.ts:205` lo devuelve; `core.ts` le pasa `message.fromMe ?? false`).
   El 0/14 inicial fue un artefacto del harness sintético, que invocó
   `processIncomingMessage` sin el parámetro `fromMe`.
3. **Los refs `_event_*_` ya coinciden** entre proveedores (mismo helper y mismo
   formato con UUID). La única excepción: Baileys **no** emite ref para `contact`
   ni para `poll` (se quedan con `body: undefined`).
4. **Baileys no tiene `type` en absoluto**; Meta siempre lo trae, pero con valores
   propios (`interactive` cubre botón y lista).
5. **El id y el timestamp viven en sitios distintos**: `key.id` / `messageTimestamp`
   frente a `message_id` / `timestamp`.
6. **Meta no expone el payload original**; Baileys lo expone expandido
   (`key`, `message`, …), lo que en la práctica es un `raw` implícito.

## 3. Propuesta: envelope canónico

Tipo compartido en `@builderbot/bot` (`src/types.ts`), siguiendo el patrón
"normalizado + `raw`" que ya usa RFC 0001 para `message_status`:

```ts
export type ProviderMessageType =
    | 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker'
    | 'location' | 'contact' | 'order' | 'poll' | 'button' | 'list'
    | 'reaction' | 'unknown'

export type ProviderMessage = BotContext & {
    /** Identificador estable para responder: dígitos (PN), JID (@g.us/@lid) o BSUID. */
    from: string
    /** Texto del mensaje o referencia `_event_*_`. */
    body: string
    name?: string
    pushName?: string
    /** Tipo normalizado. */
    type?: ProviderMessageType
    fromMe?: boolean
    /** Id del mensaje (canónico). */
    messageId?: string
    /** Unix seconds. */
    timestamp?: number
    /** Destino/negocio cuando el proveedor lo conoce. */
    to?: string
    /** Identificador opaco adicional: BSUID (Meta) o LID (Baileys). */
    userId?: string
    /** WhatsApp username del interlocutor, si WhatsApp lo envía. */
    username?: string
    /** Solo grupos. */
    participant?: string
    participantUsername?: string
    /** Payload nativo del proveedor, sin transformar (forward-compat). */
    raw?: unknown
}
```

### Reglas de `from`

1. Es **opaco y estable**: puede ser dígitos, `@g.us`, `@lid` o BSUID. Nunca se parsea.
2. Se usa como clave de estado (`stateClass` ya lo hace así).
3. Para responder se pasa tal cual a `sendMessage`.

### Reglas de `type` (normalización)

| Meta | Baileys | Canónico |
|---|---|---|
| `text` | `conversation` / `extendedTextMessage` | `text` |
| `image` | `imageMessage` | `image` |
| — | `videoMessage` | `video` |
| `audio` | `audioMessage` | `audio` |
| `document` | `documentMessage` | `document` |
| — | `stickerMessage` | `sticker` |
| `location` | `locationMessage` | `location` |
| `contacts` | `contactMessage` | `contact` |
| `order` | `orderMessage` | `order` |
| — | `pollCreationMessage` / `pollUpdates` | `poll` |
| `button` | `buttonsResponseMessage` | `button` |
| `interactive` (list) | `listResponseMessage` | `list` |
| `reaction` | `reactionMessage` | `reaction` |
| otro | otro | `unknown` |

## 3.1 Huecos detectados en `provider-baileys` (verificados)

Independientes de la estandarización, son incoherencias propias:

- `contactMessage` y `pollCreationMessage` se emiten **sin `body`** (Meta sí usa
  `_event_contacts_`; no existe ref para poll).
- No se expone `type` normalizado, así que el consumidor debe inspeccionar
  `ctx.message.*` (estructura interna de Baileys).

## 4. Plan de implementación (aditivo, por fases)

- **Fase 1 — tipos**: añadir `ProviderMessage`/`ProviderMessageType` a `@builderbot/bot`
  sin tocar `BotContext` (`ProviderMessage = BotContext & {...}`).
- **Fase 2 — `provider-baileys`**: añadir al payload `type`, `fromMe`, `messageId`,
  `timestamp`, `to` (número propio), `userId` (LID), `raw` (el `WAMessage`).
  Corregir los huecos de 3.1 (`_event_contacts_` y ref de poll).
  Mantener todo lo existente (`key`, `message`, `name`, `pushName`, `username`,
  `participant`…).
- **Fase 3 — `provider-meta`**: añadir `messageId` (alias de `message_id`), `raw`,
  `participant`/`participantUsername` (no aplica) y normalizar `type` al conjunto
  canónico conservando el valor original en `raw.type`.
- **Fase 4 — docs**: tabla única en `docs/providers/message-schema.md` + notas en cada README.

## 5. Decisiones abiertas (bloqueantes)

1. **`type` en Meta**: ¿se normaliza (`interactive` → `button`/`list`) o se deja el valor
   actual y solo se añade el canónico en `type` de Baileys?
   - (a) Normalizar: contrato único, pero puede romper consumidores que comparen
     `ctx.type === 'interactive'`.
   - (b) No normalizar: cero ruptura, pero `type` sigue significando cosas distintas.
   - (c) Añadir `contentType` canónico y dejar `type` como está (lo más seguro).
2. **Id**: ¿`messageId` nuevo en ambos (recomendado) o se reutiliza `message_id` en Baileys?
3. **`to` en Baileys**: ¿el número propio del bot (`host.phone`) o se deja `undefined`?
4. **`raw`**: ¿incluirlo siempre (peso/ruido en logs) o solo con `globalVendorArgs.includeRaw`?

## 6. No-objetivos

- Cambiar `from`/`body` (contrato del core).
- Unificar el envío (`sendMessage`), solo la recepción.
- Igualar los campos específicos de media (Meta `fileData` vs Baileys `message.*`).
- Tocar `message_status` (ya normalizado por RFC 0001).
