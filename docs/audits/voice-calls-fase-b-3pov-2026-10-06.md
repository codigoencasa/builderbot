# Fase B — Llamadas WhatsApp: análisis 3-POV (verificado contra código)

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Fase | **B — "Salientes"** (del plan `docs/audits/voice-calls-plan-2026-10-06.md`) |
| Ítems | B1 Outbound (WebRTC/Graph API) · B2 CPR (permisos) · B3 SIP mode · B4 Transferencia a humano · B5 Call settings API + deep links |
| Paquetes afectados | `provider-voice` (core + client), `provider-meta`, `provider-voice-whatsapp` (paridad), posible `provider-voice-sip` (B3) |
| POV | Consumidor API · Maintainer · Operador + Veredicto |
| Prerequisito | Fase A-W1 (plomería de eventos `call_status`) — los `statuses` solo llegan en salientes |
| Qué NO cubre | Prueba live (requiere WABA con límite ≥ 2.000 conversaciones business-initiated o sandbox) — marcado **NV** |

---

## 0. Verificación previa (hechos confirmados)

1. **Outbound se inicia por Graph API con un WebRTC offer**: `POST /{numberId}/calls` con `action: "connect"`, `to`, y `session: { sdp: <offer>, sdp_type: "offer" }` (API reference 360dialog/Meta). La respuesta llega por **webhook** `connect` con `direction: "BUSINESS_INITIATED"` y `session: { sdp_type: "answer", sdp }` (+ `connection.webrtc.sdp`).
2. **Nuestro enum está mal**: `CallAction.Call = 'call'` (`calls/types.ts:44`) — la API usa **`connect`**. Está sin usar, así que no rompe nada, pero hay que corregirlo al implementar.
3. **`MetaCallClient` es un axios fino con retry acotado** (`meta-call-client.ts:151-193`): añadir `connect(to, sdpOffer)` es trivial.
4. **El core actual es "answerer-only"**: `onConnect` asume offer entrante → crea answer → `pre_accept`+`accept` (`core.ts:134-379`). Para outbound hay que crear el offer y **aplicar** la answer remota (NO pre_accept/accept). Reutilizables tal cual: `createPeerConnection`, `waitForIceGathering` (non-trickle ICE), `createAudioSource/Sink`, `SilenceSegmenter`, `publishAudio`, `releaseSession`.
5. **CPR = template message**: `provider-meta` ya tiene `sendTemplate` (`provider.ts:729`). Meta además expone `GET /calling/permissions/{consumer_whatsapp_id}` (estado + acciones disponibles).
6. **Reglas CPR (Meta)**: permiso dura 7 días o hasta revocación; máx. **5 llamadas/24 h por usuario**; 2 no atendidas consecutivas → mensaje del sistema; 4 no atendidas → revocación automática; máx. 2 CPR/7 días. Llamada sin permiso → error **138012** ("No approved call permission"), el usuario ve un error genérico.
7. **Outbound es PAGO**: duración en incrementos de 6 s (redondeo hacia arriba) + país del usuario. Inbound es gratis. CPR se cobra como mensaje template.
8. **SIP**: dominio `wa.meta.vc`, auth digest (407 → 2º INVITE con Authorization), SDP con ICE/DTLS-SRTP/OPUS; settings SIP vía API (`srtp_key_exchange_protocol: DTLS|SDES`). En modo SIP, **inbound llega como SIP INVITE** a nuestro servidor SIP configurado.
9. **`@roamhq/wrtc@0.10.0` no tiene stack SIP** (verificado en Fase A: sin DTMF; SIP tampoco está en su API). SIP requiere stack nuevo o bridge vía LiveKit SIP (ya existe `provider-voice-sip`).
10. **Transferencia**: WhatsApp Calling (modo WebRTC) **no tiene REFER/3-way**. Transfer real = ruta SIP (derivar a softphone del agente) o patrón "colgar + callback/chat".
11. **Settings API**: `GET/POST /{numberId}/settings` con `calling.status`, `call_icon_visibility`, `call_hours` (timezone + weekly_operating_hours + holiday_schedule), `sip.status/servers`, `callback_permission_status`. `provider-meta` ya usa axios contra `graph.facebook.com` (provider.ts:13, 41).

---

## B1. Llamadas salientes vía Graph API (WebRTC)

| POV | Análisis |
|---|---|
| **Consumidor API** | DX ideal: `await provider.startCall(to, { onAnswered: flow })` o `bot.call(to)`. Requiere que el dev entienda el prerequisito de permiso (CPR) — la API debe fallar **claro** si no hay permiso (mapear 138012 a un mensaje accionable: "envía CPR primero con `requestCallPermission(to)`"). Opciones: `bizOpaqueCallbackData` para correlación. |
| **Maintainer** | Reuso alto. Nuevo en core: `startCall(to)`: crear PC + `createOffer` → `waitForIceGathering` → `client.connect(to, offer)`. El webhook `connect` BUSINESS_INITIATED debe **correlacionar** con la sesión pendiente (por `call_id` nuevo o `biz_opaque_callback_data`) y hacer `setRemoteDescription(answer)` en vez de pre_accept/accept. Estados nuevos: `Offering`/`Ringing` antes de `Active`. Corregir enum: `CallAction.Connect = 'connect'`. Riesgo de diseño: `onConnect` hoy es síncrono-asume-offer; separar paths inbound/outbound limpios. Tests: mocks de client + webhook; el path WebRTC real queda NV. |
| **Operador** | Coste por llamada (6 s + país) → necesita rate-limit local (5/24 h/usuario) y métricas de gasto. Fallos típicos: 138012 (sin permiso), "Business call limit exceeded", "Receiver uncallable". Observabilidad: emitir `call_status` (Fase A-W1) para RINGING/ACCEPTED/REJECTED. Timeout si no hay `connect` webhook en X segundos → limpiar sesión pendiente (o queda zombie en el Map). |
| **Veredicto** | ✅ Hacer. Esfuerzo **M** (1 semana con tests). Riesgo medio: correlación webhook↔sesión y roles DTLS del offer (el `transformAnswer` actpass→active aplica a answers; para nuestro offer hay que verificar qué `setup` espera Meta — **spike live**). |

---

## B2. CPR — Call Permission Request (permiso para llamar)

| POV | Análisis |
|---|---|
| **Consumidor API** | `await provider.requestCallPermission(to)` (template con botón "Permitir llamadas") y `await provider.getCallPermission(to)` → `{ status, actions, expiration }`. DX importante: el permiso se pide por mensaje y se **aprueba en la app del usuario**; la llamada solo se puede iniciar después. |
| **Maintainer** | CPR se envía como template (hay `sendTemplate`, provider.ts:729) — pero ojo: Meta puede exigir un **template de tipo "call permission request" específico** (verificar en spike; la doc habla de "CPR using text or template messages"). `getCallPermission` = GET simple. Guardar estado de permiso por usuario en DB (expira a 7 días) para no pedir de más (máx. 2/7 días). |
| **Operador** | Sin tracking de permisos quemamos el límite de 2 CPR/7 días y 5 calls/24 h. Persistir `{ grantedAt, expiresAt, callsToday }` por número. Métrica: tasa de aprobación de CPR. |
| **Veredicto** | ✅ Hacer antes de B1 (es prerequisito funcional). Esfuerzo **S–M**. Riesgo bajo, salvo confirmar el formato exacto del template CPR (spike). |

---

## B3. Modo SIP (unifica inbound+outbound+DTMF+transfer)

| POV | Análisis |
|---|---|
| **Consumidor API** | Transparente si se implementa bien: mismo `message`/`sendMessage`. Cambia el deployment: hay que correr un **servidor SIP** (TLS) accesible desde Meta — más infra que un webhook HTTPS. |
| **Maintainer** | Decisión arquitectónica grande. Opciones: (a) **stack SIP propio** en Node (drachtio/sip.js) — esfuerzo alto, otro protocolo que mantener; (b) **LiveKit SIP como bridge** — ya tenemos `provider-voice-sip` (LiveKit SIP para PSTN); LiveKit SIP soporta trunks outbound a URI arbitrarios (`sip:+<user>@wa.meta.vc;transport=tls`) y dispatch inbound a rooms → nuestro agente LiveKit (`provider-voice`) atiende. Ventaja: reusa LiveKit (que ya despliega el usuario), DTMF nativo (RFC 4733/SIP INFO lo maneja LiveKit), y resuelve DTMF de Fase A. Riesgo: LiveKit SIP está pensado para PSTN; validar que acepte el auth digest de Meta y la negociación SDP de WhatsApp. **Spike obligatorio.** |
| **Operador** | Más moving parts (SIP server, TLS, puertos, NAT). A cambio: DTMF + transfer + telemetría SIP. 360dialog avisa que la calidad/routing SIP es responsabilidad del cliente — o sea **nuestra**. |
| **Veredicto** | 🟡 **Spike (B3.0): LiveKit SIP ↔ wa.meta.vc** (1–2 días). Si funciona → SIP se vuelve el path recomendado y DTMF/transfer se desbloquean (**M–L**). Si no → outbound WebRTC (B1) sigue siendo válido y DTMF/transfer quedan limitados. **No decidir sin spike.** |

---

## B4. Transferencia a humano

| POV | Análisis |
|---|---|
| **Consumidor API** | DX deseada: `await provider.transferCall(callId, agentTarget)`. Pero **en modo WebRTC no existe** (Meta no expone REFER/3-way). Lo realista hoy: (a) patrón callback — el bot dice "te llamo un agente", cuelga, y se dispara outbound (B1) o tarea a cola humana; (b) patrón chat-handoff — terminar la llamada y continuar por chat con un humano. |
| **Maintainer** | Implementar (a) y (b) es barato sobre B1: `endCall(callId)` + evento `handoff_requested` con contexto (transcript, state). Transfer SIP real (REFER/attended) queda condicionada a B3. |
| **Operador** | El caso enterprise "escalar a humano" se vende mucho; hay que ser honesto en docs: sin SIP no hay transfer en caliente, hay callback. |
| **Veredicto** | 🟡 Parcial: implementar **callback/handoff (M)** en Fase B; **transfer en caliente solo si B3=Go**. |

---

## B5. Call settings API + deep links

| POV | Análisis |
|---|---|
| **Consumidor API** | `provider.getCallSettings()` / `provider.updateCallSettings({ callHours, callIconVisibility, sip, callbackPermission })`. Permite horarios de atención y ocultar el icono sin tocar Meta Business Manager. Deep links: `https://wa.me/call/<number>` — **cero código**, solo docs/ejemplo. |
| **Maintainer** | CRUD axios simple sobre `/{numberId}/settings` (patrón ya usado en provider.ts). Tipar `CallingSettings`. Tests con mock. |
| **Operador** | `call_hours` evita llamadas fuera de horario (las rechaza Meta). Cuidado: cambiar settings pisa config hecha a mano en WhatsApp Manager — documentar. |
| **Veredicto** | ✅ Hacer. Esfuerzo **S**. Incluir doc de deep links. |

---

## Plan Fase B alineado (orden por valor/riesgo)

| Ola | Contenido | Depende de | Riesgo | Esfuerzo |
|---|---|---|---|---|
| **B-W1** | B5 settings API + B2 CPR (template + permissions + tracking en DB) | — | Bajo | S–M |
| **B-W2** | B1 outbound WebRTC (`connect` + correlación + estados Offering/Ringing) + fix enum `CallAction.Connect` | A-W1, B-W1 | Medio | M |
| **B-W3** | **Spike live B1** (llamada outbound real: roles DTLS del offer, formato CPR, límites) | B-W2 | Alto (externo) | S |
| **B-W4** | **Spike B3.0** LiveKit SIP ↔ `wa.meta.vc` (auth digest + SDP WhatsApp) | — | Alto (externo) | S |
| **B-W5** | B4 handoff humano (callback/chat); transfer en caliente solo si B3=Go | B-W2 | Medio | M |

## Registro de sorpresas eliminadas

1. ~~"Outbound es otro webhook"~~ → se **inicia por Graph API con offer**; la answer llega por webhook `connect` BUSINESS_INITIATED → hay que correlacionar sesión pendiente.
2. ~~"`CallAction.Call='call'`"~~ → la acción real es **`connect`**; el enum actual está mal (sin uso, sin daño).
3. ~~"Llamas y ya"~~ → sin **CPR** la llamada falla con 138012; permiso 7 días, 5 calls/24 h, 2 CPR/7 días.
4. ~~"Outbound gratis como inbound"~~ → **pago** (6 s + país); CPR cobra como template.
5. ~~"Transfer = REFER"~~ → en WebRTC **no existe**; solo callback/chat o vía SIP (B3).
6. ~~"SIP es un detalle"~~ → es la vía que desbloquea **DTMF + transfer**, pero exige stack nuevo o bridge LiveKit SIP → **spike antes de decidir**.
7. ~~"El offer usa el mismo transform"~~ → `transformAnswer` (actpass→active) es para answers; el rol DTLS de **nuestro offer** hay que verificarlo en live.

## Aceptación live — NV (pendiente)

- [ ] NV1: CPR enviado y aprobado en app real (formato template confirmado).
- [ ] NV2: outbound WebRTC real (offer → ringing → answer → audio bidireccional).
- [ ] NV3: spike LiveKit SIP ↔ `wa.meta.vc` (INVITE con digest auth).
- [ ] NV4: rechazo → `call_status: REJECTED` y cleanup de sesión pendiente (sin zombies en el Map).

---

## Fuentes

- Repo: `packages/provider-voice/src/calls/{core,types,meta-call-client,webrtc}.ts`, `packages/provider-meta/src/meta/provider.ts` (sendTemplate:729, axios patterns).
- 360dialog/Meta — Outbound (CPR, `connect` con offer, SIP `wa.meta.vc`, digest 407, límites): `https://docs.360dialog.com/docs/messaging/calling/outbound-calls`
- 360dialog/Meta — Settings API (call_hours, icon, sip, srtp DTLS/SDES): `https://docs.360dialog.com/docs/messaging/calling/how-to-configure-calling-api`
- 360dialog/Meta — API reference `/calling/calls` (acciones pre_accept/accept/reject/connect) y `/calling/permissions/{id}`: `https://docs.360dialog.com/docs/messaging-api/api-reference/calling`
- Deep links `wa.me/call/<number>`: misma fuente inbound-calls.
