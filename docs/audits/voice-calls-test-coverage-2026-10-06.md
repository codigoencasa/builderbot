# Cobertura de tests — llamadas WABA: comparativa con proyectos GitHub similares

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Objetivo | Contrastar nuestros tests de llamadas WhatsApp contra proyectos similares en GitHub y detectar huecos (y bugs) |
| Nuestros tests | `provider-voice/__tests__/{calls-core, calls-meta-call-client, calls-sdp, audio, stt, tts}.test.ts`, `provider-voice-whatsapp/__tests__/webhook.test.ts`, `provider-meta/__tests__/{core,provider,lazyVoiceImport}.test.ts` |
| Veredicto corto | Cobertura **fuerte en inbound + STT/TTS + SDP + retry**, pero: (1) **bug real encontrado** (acciones de API inválidas enshrineadas en tests), (2) huecos en race conditions, ventana de aceptación, `statuses`, `biz_opaque_callback_data`, y todo lo outbound (Fase B) |

---

## 1. Proyectos comparados

| Repo | Qué es | Tests de calls | Madurez |
|---|---|---|---|
| `david-lev/pywa` | SDK Python tipado para Cloud API (incluye calls) | ✅ tests de shape HTTP: `initiate_call` (connect+offer+`biz_opaque_callback_data`), `pre_accept_call`, `accept_call`, `reject_call`, `terminate_call`, `get_call_permissions`, validación de args | Alta (SDK mantenido) |
| `chatwoot/chatwoot` PR #14356 + **#14357** | Bridge WhatsApp Cloud Calling → pipeline de voz | ✅ specs: state machine (ringing→in_progress→completed/failed/no_answer), guards (AlreadyAccepted/NotRinging/calling_disabled/sin sdp_offer), **138006 sin permiso → reenvío de template opt-in throttled + idempotencia**, **race terminate-during-accept con lock**, upload_recording idempotente | Alta (producto enterprise) |
| `WebRTCventures/whatsapp-webrtc-application` | POC webhook + WebRTC a browser | ❌ sin tests | POC |
| `barisyeman/WhatsApp-Cloud-API-Voice-Calling` | Guía end-to-end | ❌ | Guía |
| `aws-samples/sample-multimodal-whatsapp-restaurant-agent` | Agente voz AI (aiortc) | Mínimos | Sample |
| `tyntec/whatsapp-calling-test-ui` | Bridge WhatsApp↔browser (wrtc) | ❌ | POC |
| `daily-co/pcc-gemini-whatsapp` | Voice bot Gemini (Pipecat) | Mínimos | Sample |
| `siphon-project/siphon-sip` | Gateway SIP↔WhatsApp (`wa.meta.vc`) | Algunos | Medio |
| `1msg/1msg-sdk-php`, `wats.sh` | SDKs con calling | shape HTTP | Medio |

> Conclusión del barrido: **casi nadie testea el pipeline de media** (WebRTC/SDP/audio) — los tests serios son de (a) shape HTTP del API de calls y (b) máquina de estados + errores de negocio. Ahí es donde debemos igualar.

---

## 2. 🐛 Hallazgo crítico (bug real, encontrado en esta comparativa)

**Nuestros valores de `CallAction` no coinciden con la API de Meta.**

```ts
// packages/provider-voice/src/calls/types.ts
export enum CallAction {
    PreAccept = 'pre_accept',  // ✅
    Accept = 'accept',         // ✅
    Reject = 'reject',         // ✅
    End = 'end',               // ❌ Meta espera 'terminate'
    Call = 'call',             // ❌ Meta espera 'connect'
}
```

**Evidencia (4 fuentes independientes):**
- Meta docs oficiales: "*Send a POST request with the appropriate action (**connect, pre_accept, accept, reject, terminate**)*" — `developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/calling-api`
- Meta reference: "*…when the business calls `POST /<PHONE_NUMBER_ID>/calls` endpoint with an action of `terminate` or `reject`*" — `developers.facebook.com/docs/whatsapp/cloud-api/calling/reference/`
- pywa: `test_terminate_call` envía `action: "terminate"`; `test_initiate_call` envía `action: "connect"`.
- wats.sh SDK: tabla `initiateCall → connect`, `terminateCall → terminate`. kapso API docs: idem.

**Impacto:** `MetaCallClient.end()` envía `action: 'end'` → Meta respondería 4xx (acción inválida) y **la llamada no se colgaría**. En la práctica el daño hoy es acotado: tras una llamada activa, Meta cuelga igualmente cuando el usuario cuelga o expira la sesión, y nuestro `releaseSession` limpia local. Pero `end()` es API pública y está rota.

**Agravante:** nuestro propio test `end sends correct action` (`calls-meta-call-client.test.ts`) **enshrinea el bug** — pasa en verde afirmando el valor incorrecto.

**Fix propuesto:** `End = 'terminate'`, `Call = 'connect'` + actualizar tests para afirmar los strings exactos de la API (con comentario que cite la doc de Meta). Esfuerzo **trivial**, riesgo bajo.

---

## 3. Inventario: qué cubren nuestros tests (40 tests de calls + 15 audio)

**calls-core (21):** terminate (notice, cleanup, idempotente), lookup (`hasActiveCall`, `getActiveCallId`), `publishAudio` guards (sin sesión/sin source), STT→message (vacío, whitespace, error, payload con audio+sampleRate, `from`=callerPhone), preAccept+accept con SDP idéntico, accept-fail→`end`, connect duplicado, connect sin SDP.

**meta-call-client (10):** orden preAccept→accept, payloads, retry 1× en 5xx, no-retry en 400/401, actions end/reject.

**sdp (9):** actpass→active (idempotente, global), Opus presente/ausente.

**webhook voice-whatsapp (14):** 200 siempre, routing connect/terminate, verify token (200/403), campos no-calls, payloads vacíos.

**provider-meta:** routing `calls` vs `messages` (sin regresión), dispatch a `callVendor`, `publishAudio` cuando hay llamada activa, lazy import de provider-voice.

**audio (15):** segmenter (leading silence, min/max utterance, force-cut, reset), WAV header, resample, chunk.

**Fortalezas propias que los demás no muestran:** guards de STT (vacío/whitespace/error), idempotencia de terminate, pacing/estructura del segmenter con `maxUtteranceMs`, política de retry 4xx/5xx, webhook "siempre 200", lazy-import del módulo nativo.

---

## 4. Huecos detectados (escenarios que otros cubren / la doc exige y nosotros no testeamos)

### P0 — Bug / contrato de API
| # | Escenario | Fuente | Estado |
|---|---|---|---|
| T1 | `end` → `terminate`, `call` → `connect` (strings exactos de Meta) | Meta docs + pywa + wats + kapso | ✅ **arreglado 2026-10-06** (enum con `Terminate`/`Connect` + alias deprecated `End`/`Call`; `MetaCallClient.end()` envía `terminate`; tests de contrato añadidos) |

### P1 — Lógica inbound que ya tenemos pero sin test
| # | Escenario | Fuente | Estado |
|---|---|---|---|
| T2 | **Race: `terminate` mientras `onConnect`/accept está en vuelo** (lock contention) | chatwoot #14357 | ✅ **arreglado 2026-10-06** (guards de liveness en `core.ts` antes de `pre_accept` y de `accept`; test de race con mutation-check: falla sin el guard) |
| T3 | **Ventana de aceptación 30–60 s**: si no se hace pre_accept/accept a tiempo, Meta cuelga ("Not Answered") → cleanup de sesión pendiente (sin zombie en `sessions`) | Meta docs ("*about 30 to 60 seconds after the Call Connect webhook*") | ❌ requiere feature (timeout de sesión pendiente) — Fase A |
| T4 | Webhook con **`value.statuses`** (RINGING/ACCEPTED/REJECTED) — parseo y no-romper inbound | Meta docs (business-initiated) | ❌ (Fase A-W1) |
| T5 | **`biz_opaque_callback_data`** propagado y devuelto en el terminate webhook | Meta reference + pywa | ❌ |
| T6 | **Rebuild del segmenter por cambio de sample rate mid-call** (`wireAudioSink`, core.ts:530) | nuestro código | ✅ **cubierto 2026-10-06** (test: 48k→16k reconstruye segmenter y flushea el viejo) |
| T7 | **Playback pacing y cancelación** (`pushFramesPaced`, `playbackCancel`) — base de barge-in (A1) | nuestro código | ✅ **cubierto 2026-10-06** (test: terminate mid-playback detiene frames) |
| T8 | **ICE gathering timeout** (`waitForIceGathering(timeoutMs)`) → error manejado | nuestro código | ✅ **cubierto 2026-10-06** (calls-webrtc.test.ts: complete/in-time/timeout/restore handler) |
| T9 | Mapeo de errores Meta a mensajes accionables: **138006** (sin permiso) / **138012** (no approved permission) | Meta docs + chatwoot | ❌ (Fase B) |

### P2 — Features futuras (tests a escribir con su fase)
| # | Escenario | Fuente | Fase |
|---|---|---|---|
| T10 | `initiate_call`: shape `connect` + offer + `to` + `biz_opaque_callback_data` | pywa | B |
| T11 | `get_call_permissions`: GET con `user_wa_id`, validación de args | pywa | B |
| T12 | 138006 → reenvío throttled del template de permiso + **idempotencia** | chatwoot | B |
| T13 | State machine outbound: ringing→in_progress→completed/failed/no_answer | chatwoot | B |
| T14 | Upload de grabación **idempotente** (`already_uploaded`) | chatwoot | D |
| T15 | `voice_enabled?` matrix (config × flags) | chatwoot | A |

---

## 5. Recomendación ejecutiva

1. **Hoy (trivial):** fix `CallAction` (T1) + tests que afirmen los strings exactos citando la doc de Meta. Es un bug real en API pública.
2. **Con Fase A (A-W1):** T4 (statuses), T5 (biz_opaque), T2 (race terminate-during-connect), T3 (ventana de aceptación → cleanup).
3. **Con Fase A-W2 (barge-in):** T7 (pacing/cancel), T6 (rebuild por sample rate), T8 (ICE timeout).
4. **Con Fase B (salientes):** T9–T13 (copiar el enfoque de pywa para shape HTTP y el de chatwoot para estados/permisos/idempotencia).
5. **Con Fase D:** T14 (grabación idempotente), T15 (matrix de config).

**Respuesta a "¿cubrimos todo al máximo?":** No. Inbound+STT/TTS está bien cubierto (40 tests), pero hay un **bug de contrato con Meta** (T1) y **9 escenarios** de la doc oficial/competencia sin cobertura (T2–T9), además de los propios de las fases futuras (T10–T15). Ninguno requiere media real — todos son testeables con los mocks actuales.

---

## Fuentes

- Meta — Calling API reference (acciones `connect|pre_accept|accept|reject|terminate`, 138006, biz_opaque_callback_data): `https://developers.facebook.com/docs/whatsapp/cloud-api/calling/reference/`
- Meta — Calling API (POST /calls actions, GET call_permissions): `https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/calling-api`
- Meta — User-initiated calls (ventana 30–60 s de aceptación): `https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-initiated-calls`
- pywa tests: `https://raw.githubusercontent.com/david-lev/pywa/master/tests/test_api.py`
- chatwoot specs de calls: `https://github.com/chatwoot/chatwoot/pull/14357/files`
- wats SDK calling: `https://wats.sh/docs/reference/calling`
