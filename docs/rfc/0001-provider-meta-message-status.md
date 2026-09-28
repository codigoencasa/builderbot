# RFC 0001 — `provider-meta`: structured outbound message-status events

| Field | Value |
|---|---|
| Status | **Draft** (pendiente de aprobación) |
| Author | Engineering (agent-assisted) |
| Issue | [codigoencasa/builderbot#1262](https://github.com/codigoencasa/builderbot/issues/1262) |
| Provenance | [Discussion #1261](https://github.com/codigoencasa/builderbot/discussions/1261) |
| Reviewers | Maintainer (`@leifermendez`), provider-meta owner |
| Target version | `1.4.x` (minor — additive + one documented behavior change) |
| Risk | Low (localizado en un provider, sin migración de datos) |

---

## 1. Summary (PR-FAQ)

**Problem.** El provider de Meta descarta los webhooks de estado de entrega de mensajes salientes (`sent`, `delivered`, `read`) y, ante un `failed`, emite un `notice` con un string legible por humanos (`Number(...): ...`). No hay forma de correlacionar el ciclo de vida de un mensaje con el `wamid` que Meta devuelve al enviarlo.

**Proposal.** Emitir un evento tipado **`message_status`** en todas las etapas del ciclo de vida, con `id` (wamid), destinatario, `status`, `timestamp` y `errors`; preservar el `notice` actual en fallos (backward compatible); y corregir la respuesta HTTP del webhook de estados.

**Impact.** Los consumidores podrán construir tracking de entrega fiable (`accepted → sent → delivered → read | failed`) correlacionando por wamid, sin *pattern matching* sobre strings. Cambio aditivo salvo la semántica de respuesta HTTP del webhook de estados, documentada como breaking explícito y mitigada con flag.

---

## 2. Motivation

- Issue #1262 (autor `sebabratakundu`, sin assignee) documenta la carencia con reproducción.
- Discussion #1261 (`yudin-s`) describe el patrón correcto de **dos capas**:
  1. **Síncrona:** `sendMessageMeta()` → `sendMessageToApi()` retorna `response.data`, que en Meta contiene `messages[0].id` (wamid). → estado `accepted`.
  2. **Asíncrona:** webhook `value.statuses[]` con `sent/delivered/read/failed`, correlacionado por `status.id`.

**Verificación de código (estado actual en `builderbot@accb3ec3`):**

| Hecho | Evidencia |
|---|---|
| `extractStatus` colapsa a `{status, reason}` y pierde `id`/`timestamp`/`errors` | `packages/provider-meta/src/meta/core.ts:102-126` |
| Solo `failed` dispara `notice` genérico + HTTP 400 | `core.ts:237-247` |
| `sent/delivered/read` caen en `res 200 'empty endpoint'` y se descartan | `core.ts:255-259` |
| `MessageStatus` no tiene `id` ni `timestamp` | `types.ts:316-320` |
| El wamid saliente **ya** está disponible | `provider.ts:1215` (`return response.data`) |
| No existe canal `message_status` en el bus | `provider.ts:285` (`busEvents`) |

> Nota: el issue cita rutas v1 obsoletas (`packages/provider/src/meta/server.js`). El código real es `packages/provider-meta/src/meta/*.ts`.

---

## 3. Goals / Non-goals

### Goals
1. Preservar todos los campos relevantes de `value.statuses[]`: `id`, `recipient_id`, `recipient_user_id`, `status`, `timestamp`, `errors`, y `raw` como escape hatch.
2. Emitir `message_status` en **todas** las etapas (`sent`, `delivered`, `read`, `failed`) y para estados desconocidos.
3. Mantener `notice` en fallos (compat).
4. Tipar el evento en `@builderbot/bot` (`ProviderEventTypes`) para DX.
5. Semántica de respuesta HTTP correcta para webhooks de estado (evitar retry storms).
6. Cobertura de tests ≥ la actual, sin regresiones en el camino de mensajes.

### Non-goals
1. Persistir el estado en DB (responsabilidad del consumidor).
2. Reconciliación/reintentos de estados perdidos.
3. Cambiar el contrato de `sendMessageMeta`/`sendMessageToApi`.
4. Soporte de `statuses` para otros providers (fuera de scope, aunque el patrón es reusable).

---

## 4. Proposed design

### 4.1 Type changes (`packages/provider-meta/src/types.ts`)

```ts
export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | (string & {})

export interface MessageStatusError {
    code?: number
    title?: string
    message?: string
    error_data?: { details?: string }
}

export interface MessageStatus {
    id?: string                 // wamid — correlation key
    recipient_id?: string
    recipient_user_id?: string  // BSUID path
    status?: WhatsAppMessageStatus
    timestamp?: string
    errors?: MessageStatusError[]
    conversation?: { id?: string; origin?: { type?: string } }
    pricing?: { billable?: boolean; pricing_model?: string; category?: string }
}

/** Normalized, forward-compatible payload emitted as `message_status`. */
export interface MessageStatusEvent {
    id: string | null              // wamid; null if Meta omitted it
    recipientId: string | null
    recipientUserId: string | null
    status: WhatsAppMessageStatus
    timestamp: string | null
    errors: MessageStatusError[]
    raw: MessageStatus             // escape hatch for future Meta fields
}
```

Design rationale:
- `(string & {})` keeps autocompletion for known statuses **and** accepts unknown future values without a breaking type change.
- `raw` garantiza forward-compatibilidad (principio "Postel / tolerant reader").
- `MessageStatusError` se enriquece pero todos los campos nuevos son opcionales → no rompe.

### 4.2 Event contract

- **Nombre:** `message_status`.
  - Alternativas descartadas: `status` (demasiado genérico, colisionable), `delivery_status` (sugiere solo entrega), `message_delivery` (no cubre `failed`).
- **Payload:** `MessageStatusEvent` (uno por cada entry de `statuses[]`).
- **Garantías:** *at-least-once*, **desordenado** (ver §4.5).
- **Emisor:** `MetaCoreVendor` (EventEmitter) → reenviado por `MetaProvider.busEvents` a la instancia del provider.

### 4.3 Processing flow (`core.ts → incomingMsg`)

```
signature check (sin cambios, 401)
  ↓
calls change? (sin cambios)
  ↓
globalVendorArgs? (sin cambios)
  ↓
statuses present?  ← NUEVO
   for each entry / change / status:
       emit('message_status', normalize(status))
   if any failed:
       emit('notice', { title, instructions:[reason] })   // compat
       respond 200 'OK'                                    // ← cambio (§4.4)
   else:
       respond 200 'OK'
   return
  ↓
messages path (sin cambios)
```

Puntos clave:
- **Iterar todas** las entries/changes con statuses (no solo `[0].changes[0]`), corrigiendo una limitación latente.
- No bloquear: la emisión es **síncrona** sobre `EventEmitter`; el procesamiento pesado queda en el consumidor.
- Se preserva el orden de cómputo O(S) actual.

### 4.4 Response semantics (decisión de diseño)

Hoy, un `failed` responde **HTTP 400**, lo que hace que **Meta reintente** el webhook repetidamente. La práctica correcta es **responder 200** y manejar el fallo internamente.

- **Recomendación:** responder **200 `'OK'`** en todos los webhooks de estado.
- **Mitigación de compatibilidad:** flag de configuración `globalVendorArgs.statusWebhookRespondOnFailure?: 'ok' | 'legacy-400'` con default `'ok'`; `'legacy-400'` conserva el contrato previo durante una release.
- Documentar como **breaking change** en `CHANGELOG` bajo `BREAKING CHANGES`.

### 4.5 Ordering / idempotency semantics (contrato explícito)

Meta **no garantiza** orden ni unicidad de los webhooks. El evento es:
- **At-least-once** → el consumidor debe deduplicar por `(id, status, timestamp)`.
- **Desordenado** → el consumidor debe aplicar ranking monotónico:

  `failed(0) < sent(1) < delivered(2) < read(3)` (no degradar estado por un evento tardío).

Se documentará explícitamente; opcionalmente se exportará un helper `statusRank(status): number` para estandarizar el ranking en consumidores.

### 4.6 Outbound correlation (sin cambios de contrato)

`sendMessageToApi` ya retorna `response.data` con `messages[0].id`. Se documenta como el wamid a persistir. Fuera de scope cambiar el comportamiento de `catch → return error` (resuelve con objeto Error en vez de rechazar), pero se registrará como hallazgo separado.

### 4.7 Bus propagation

- `packages/provider-meta/src/meta/provider.ts → busEvents()`: agregar
  ```ts
  { event: 'message_status', func: (payload: MessageStatusEvent) => this.emit('message_status', payload) }
  ```
- `packages/bot/src/types.ts → ProviderEventTypes`: declarar `message_status: [arg1: MessageStatusEvent]` (el index signature ya lo permite, pero la declaración explícita da autocompletado). Requiere exportar `MessageStatusEvent` desde conveniencia o tipar como `any` para no acoplar `@builderbot/bot` a provider-meta.

---

## 5. Backward compatibility & migration

| Surface | Antes | Después | Compat |
|---|---|---|---|
| Evento `notice` en fallo | sí | sí (mismo shape) | ✅ |
| Evento `message_status` | no existe | se emite | ✅ aditivo |
| Respuesta status `failed` | 400 + lista serializada | 200 `'OK'` | ⚠️ breaking, flag opt-out |
| `MessageStatus` type | 4 campos | +campos opcionales | ✅ |
| `extractStatus` privado | `{status,reason}` | estructura completa | ⚠️ test-only (privado) |
| Camino de `messages` | sin cambios | sin cambios | ✅ |

Migración para consumidores que dependían del 400/body serializado: usar el nuevo evento `message_status` o activar `statusWebhookRespondOnFailure: 'legacy-400'`.

---

## 6. Failure modes

| Escenario | Comportamiento |
|---|---|
| `statuses` sin `id` | emitir con `id: null` + `console.warn` (no descartar) |
| `status` desconocido | emitir con string tal cual |
| Payload malformado / sin entry | responder 200, no throw |
| Firma inválida | 401 (sin cambios) |
| `globalVendorArgs` ausente | 200 `'empty endpoint'` (sin cambios) |
| Webhook mixto status+messages | estados primero, luego si hay messages seguir el flujo; Meta no los mezcla, pero se defiende |

---

## 7. Observability

- `notice` en fallo: se mantiene (título `🔔 META ALERT 🔔`).
- Nuevo log `debug` (opcional) para status desconocido.
- No se introducen métricas (no hay infra de métricas en core). Se documenta que el consumidor puede contar sus propios eventos.

---

## 8. Performance

- Sin nuevas operaciones asíncronas ni I/O.
- O(S) ya existente para extracción; la emisión es O(S) adicional sobre `EventEmitter` síncrono.
- Sin impacto en memoria (payloads efímeros, no retención).

---

## 9. Security

- La verificación de firma HMAC (`X-Hub-Signature-256`) se mantiene **antes** de procesar estados.
- No se loguean tokens ni PII más allá del `recipient_id` ya presente.
- No se ejecuta input de Meta (no `eval`); solo parseo de campos.

---

## 10. Testing strategy (FAANG-grade)

### 10.1 Unit — `__tests__/core.test.ts`
- `extractStatus` (reescrito): todos los fields preservados; BSUID (`recipient_user_id`); `errors` múltiples; `id`/`timestamp` ausentes → null; status desconocido.
- `incomingMsg` statuses:
  - `sent` → 1 evento `message_status`, HTTP 200, **sin** `notice`.
  - `delivered` / `read` → idem.
  - `failed` → evento + `notice`, HTTP 200 (default), con flag `legacy-400` → 400 + body previo.
  - múltiples entries/changes con statuses → todos emitidos.
  - payload duplicado → dos eventos (documenta at-least-once).
- No-regresión: camino de `messages` intacto (tests existentes verdes).
- Firma inválida sigue 401.

### 10.2 Contract test
- Snapshot del shape de `MessageStatusEvent`.

### 10.3 Property-based (opcional, si el repo añade `fast-check`)
- N estados aleatorios → exactamente N emisiones; nunca throw.

### 10.4 Integration
- POST realista a `/webhook` (status payload) verificando emisión + status HTTP.

### 10.5 Quality gates
- `pnpm --filter @builderbot/provider-meta test` verde.
- `npx eslint packages/provider-meta/src packages/provider-meta/__tests__` sin errores.
- Cobertura de `core.ts` no disminuye.

---

## 11. Rollout & rollback

- **Rollout:** cambio aditivo; flag `statusWebhookRespondOnFailure` default `'ok'`. Sin migración de datos.
- **Rollback:** revertir el commit; el evento es aditivo, no hay estado persistido. Consumidores que adopten el evento deben tratar su ausencia (defensive).
- **Versionado:** minor `1.4.x`; breaking de HTTP documentado.

---

## 12. Alternatives considered

| Alternativa | Veredicto |
|---|---|
| Enriquecer `notice` con campos estructurados | ❌ Rompe el contrato `{title, instructions}` y sigue siendo canal humano, no máquina |
| Emitir solo en `failed` | ❌ No resuelve el ciclo de vida |
| Persistir estado en `MetaCoreVendor` | ❌ Scope creep; el core no tiene DB y el consumidor es dueño |
| Paquete nuevo `provider-meta-status` | ❌ Overkill |
| Webhook HTTP 400 en fallo | ❌ Provoca retries de Meta |

---

## 13. Open questions (requieren decisión del maintainer)

1. **HTTP response:** ¿default `200` (recomendado) o mantener `400` con evento `message_status` como único añadido?
2. **Nombre del evento:** ¿`message_status` o preferencia por otro?
3. **Declaración en `@builderbot/bot`:** ¿tipar `message_status` explícitamente (acopla bot ↔ provider-meta) o dejarlo al index signature?
4. **Incluir `conversation`/`pricing`** en el payload o solo vía `raw`.

---

## 14. Task breakdown

1. `types.ts`: extender `MessageStatus` + `MessageStatusError`; añadir `MessageStatusEvent`.
2. `core.ts`: refactor `extractStatus` → `normalizeStatuses`; emitir `message_status`; nueva semántica de respuesta con flag.
3. `provider.ts`: busEvent `message_status`.
4. `@builderbot/bot` (`types.ts`): declaración opcional del evento.
5. Tests: unit + contract + integración.
6. Docs: provider-meta README/docs + `CHANGELOG`.
7. (Opcional) helper `statusRank`.

**Estimación:** ~0.5–1 día de ingeniería; diff acotado a 2–4 archivos + tests.

---

## 15. Acceptance criteria

- [ ] Webhooks `sent`/`delivered`/`read`/`failed` emiten `message_status` con `{ id, recipientId, recipientUserId, status, timestamp, errors, raw }`.
- [ ] `notice` sigue emitiéndose en `failed` (shape intacto).
- [ ] Respuesta HTTP por defecto 200 en status webhooks; flag `legacy-400` disponible.
- [ ] `MessageStatus` con campos nuevos (todos opcionales).
- [ ] Camino de `messages` sin regresiones; suite completa verde.
- [ ] Lint sin errores; `CHANGELOG` actualizado.

---

## 16. Review gates (mapeo FAANG)

| Gate | Checklist |
|---|---|
| **API/Contract review** | Nombre de evento estable, payload tipado, forward-compat (`raw`), garantías documentadas |
| **Reliability review** | Sin retry storms (200), at-least-once/desorden documentado, sin throw en payloads malformados |
| **Security review** | Firma HMAC antes de procesar, sin leakage de secretos |
| **Testing review** | Unit + contract + integración + no-regresión; property-based opcional |
| **Rollout review** | Flag, rollback trivial, breaking change declarado |
| **Docs review** | README + CHANGELOG + guía de correlación (`accepted → … → read`) |
