# Plan — Llamadas de WhatsApp + IA: qué tenemos, qué falta y competencia

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Alcance | Paquetes de voz/llamadas del monorepo + gap analysis vs. competencia (360dialog, Meta, Twilio, plataformas de voz IA) |
| Paquetes auditados | `provider-voice`, `provider-voice-whatsapp` (deprecado), `provider-voice-sip`, `provider-meta` (`enableVoiceCalls`) |
| Evidencia repo | lectura de `src/`, `git log`, tests por paquete, `docs/rfc/0004` |
| Evidencia externa | docs de 360dialog, benchmarks independientes (Cekura Bench) y docs de Meta Calling API — ver §7 Fuentes |
| Qué NO cubre | prueba real de una llamada WhatsApp extremo a extremo (requiere WABA + número elegible + app con Calling API) |

---

## 1. Resumen ejecutivo

Hoy podemos **recibir** llamadas de WhatsApp entrantes y responder con IA por flujo (STT → LLM → TTS). Eso ya es un producto usable y **está en el paquete activo `provider-meta`** con `enableVoiceCalls: true`.

Lo que falta para ser **competitivo** en el mercado actual no es "recibir y responder", sino lo que rodea a eso:

1. **Llamadas salientes** (Meta las soporta; nosotros no las implementamos).
2. **Barge-in / interrupción** (poder callar al bot hablando encima).
3. **Latencia baja real-time** (hoy es pipeline por turnos con 800 ms de silencio; la competencia mide 1,27–3,08 s).
4. **DTMF / IVR**, transferencia a humano, grabación y analytics.

Y el riesgo estratégico mayor: **Meta Business Agent (MBA)** — el agente IA nativo de Meta sobre la propia Cloud API (lanzado 2026-07-01, $2,00 / 1M tokens, facturado directo por Meta, salteando al BSP). Cualquier producto de "agente IA en WhatsApp" compite ahora contra el dueño del canal.

**Madurez actual (scorecard, §5): ≈ 44 / 100.** Fuerte en inbound + pipeline de audio; nulo en salientes, turn-taking y operación.

---

## 2. Qué tenemos (inventario)

### 2.1 Paquetes

| Paquete | Rol | Estado | LOC `src` | Tests | Últ. edición |
|---|---|---|---|---|---|
| `@builderbot/provider-voice` | Voz realtime LiveKit **+ core compartido de llamadas Meta** (`MetaCallCoreVendor`, `MetaCallClient`, SDP, WebRTC) + 4 adapters STT/TTS | 🟢 activo (core) | 2831 | ~59 | 2026-07-03 |
| `@builderbot/provider-meta` | Provider Meta completo **+ voz opt-in** (`enableVoiceCalls`) | 🟢 activo y recomendado | — | ~160 | **2026-10-05** |
| `@builderbot/provider-voice-whatsapp` | Wrapper standalone de llamadas WhatsApp | 🔴 deprecado | 641 | ~14 | 2026-07-03 |
| `@builderbot/provider-voice-sip` | Voz PSTN/SIP vía LiveKit SIP (**no es WhatsApp**) | 🟢 activo | 881 | ~15 | 2026-07-02 |

> `git log -1 -- <pkg>` devuelve el bump `v1.4.4` para todos (toca los `package.json`). La tabla usa el último commit de `src/` ignorando el chore cosmético `7a1066f8` (LAYER/BigIO headers).

### 2.2 Capacidades que YA funcionan

**Inbound WhatsApp call (end-to-end):**
- Webhook Meta `field: "calls"`, handshake `hub.verify_token`.
- Negociación **SDP/WebRTC**: `pre_accept` → `accept` → `CallState.Active`.
- Pipeline de audio: `SilenceSegmenter` (default `silenceMs: 800`, `silenceThreshold: 0.015`) → **STT** → evento `message` con `ctx.audio` (PCM) y `ctx.sampleRate`.
- **TTS** → PCM → frames por WebRTC (`publishAudio`), envío *paced*.
- Multi-sesión: `sessions: Map<callId, CallSession>`, `phoneToCallId`, `hasActiveCall`, `getActiveCallId`.
- Estados: `Idle → Connecting → PreAccepted → Accepted → Active → Terminated`.

**STT/TTS pluggable (4+4 adapters):**
- STT: OpenAI (Whisper), Deepgram.
- TTS: OpenAI, ElevenLabs, Deepgram, Cartesia.

**Integración con el motor de flujos:**
- Las transcripciones entran como `message` normal → cualquier flujo/keyword funciona.
- Responder con `flowDynamic`/`sendMessage` durante una llamada activa → se sintetiza a voz.
- Flujo catch-all para conversación libre: `addKeyword('/.*/', { regex: true })` + `addAction`.
- `timeout` por flujo (`options.timeout`, fix RFC 0004) para LLMs lentos.

**Infra ya presente y reutilizable:**
- LiveKit (`@livekit/rtc-node`, `livekit-server-sdk`) + SIP (PSTN) en `provider-voice-sip`.
- 5 bases de datos (memory/json/mongo/mysql/postgres) + 13 providers de mensajería.
- Motor de flujos, state por usuario, blacklist, dispatch de eventos.

### 2.3 Lo que NO tenemos (confirmado en código)

| Capacidad | Evidencia |
|---|---|
| Llamadas **salientes** | `CallAction.Call` y `CallDirection.BusinessInitiated` definidos en `calls/types.ts` pero **sin uso**. `MetaCallClient` solo tiene `preAccept/accept/end/reject`. |
| **Barge-in / interrupción** | `grep -i barge\|interrupt\|stopPlayback` en `calls/*.ts` → **0 resultados**. No hay corte de reproducción al detectar voz. |
| **DTMF** | `grep -i dtmf` en todo `packages/*/src` → **0 resultados**. |
| **Grabación / transcripción persistida** | `grep -i record\|recording\|transcript` → solo comentarios. Nada se guarda. |
| **Eventos de estado de llamada al flujo** | El core solo emite `notice` y `message`. No hay `ringing/accepted/rejected/terminate` hacia el flujo. |
| **Saludo al conectar** | No hay evento "call ready" al flujo → el bot responde recién cuando el llamante habla. |
| **SIP para WhatsApp calling** | Meta lo soporta; nuestro SIP (LiveKit) no está cableado a la Calling API de Meta. |
| **Transferencia a humano** | No implementada. |
| **Call settings API** | No gestionamos `call_icon_visibility`, `call_hours`, `sip.status`, deep links. |
| **Concurrencia / métricas / observabilidad** | Sin límites, sin dashboards, sin alertas. |
| **Streaming / realtime** | STT/TTS por turnos (batch por utterance), no streaming ni realtime API. |

---

## 3. Competencia

### 3.1 360dialog (BSP — Meta Solution Partner)

- **Qué es:** Business Solution Provider. Da acceso a la **Cloud API**, onboarding de números y Partner Platform. No es un producto de IA de voz.
- **Calling API:** soporta la conexión, **pero el cliente/partner es responsable de la infra SIP/WebRTC** ("*360Dialog supports the API connection itself, but partners/clients are responsible for configuring and managing SIP/WebRTC — including call quality and routing*").
- **Endpoints:** `POST /calling/calls` (`pre_accept|accept|reject|connect`), `GET/POST /calling/settings`, `GET /calling/permissions/{consumer_whatsapp_id}`. Base `https://waba-v2.360dialog.io`, header `D360-API-KEY`.
- **Soporta Meta Business Agent (MBA)** para sus clientes.
- **Lectura:** 360dialog es **proveedor de acceso**, no competidor directo de "agente IA de voz". Es el tipo de capa sobre la que BuilderBot correría. El competidor real de producto es Meta (MBA) y, en la capa de voz, las plataformas de §3.3.

### 3.2 Meta (el dueño del canal)

**WhatsApp Calling API (Cloud API):**
- Inbound (**gratis** para el negocio) y outbound (**pago**: duración en incrementos de 6 s + país).
- Outbound requiere **Call Permission Request (CPR)** vía template: permiso dura 7 días, máx. 5 llamadas/24 h por usuario, revocación tras 4 no atendidas, máx. 2 CPR/7 días.
- Límite: **1.000 llamadas concurrentes por WABA**.
- Webhooks: `connect`, `terminate`, `status` (`RINGING|ACCEPTED|REJECTED`).
- **DTMF soportado**, **SIP + WebRTC**, deep links, call icon visibility, call hours.
- **NO rutea a PSTN** (no hay salida a teléfono fijo/móvil) → `provider-voice-sip` (PSTN) **no aplica** a WhatsApp calling.
- Toda llamada abre/refresca la **ventana de servicio de 24 h**.

**Meta Business Agent (MBA)** — ⚠️ riesgo estratégico:
- Agente IA nativo de Meta sobre la Cloud API. Lanzado **2026-07-01**; cobro desde **2026-08-01** a **$2,00 / 1M tokens**, **facturado directo por Meta** (saltea al BSP).
- Al activarse, MBA es el **respondedor primario**; la app del partner pasa a *standby* (sigue recibiendo todo el tráfico) y **retoma control** enviando un mensaje; devuelve el control con Thread Control (`release`).
- Requiere número Cloud API + elegibilidad (`agent_eligibility`) + ToS de Meta + método de pago.

### 3.3 Plataformas de voz IA (la capa que hoy no tenemos)

Benchmark independiente (Cekura Bench, cohorte vigente):

| Plataforma | pass³ | Sin fallos de conexión | Interrupción /5 | Voz /5 | Respuesta media |
|---|---|---|---|---|---|
| **Retell AI** | **75,61 %** | 98,37 % | **5,00** | 4,36 | 2,21 s |
| **LiveKit Agents** | 70,73 % | 99,19 % | 4,97 | 4,36 | 2,59 s |
| **ElevenLabs Agents** | 69,51 % | **100 %** | 4,96 | **4,47** | **1,27 s** |
| GPT Realtime | 64,63 % | 95,53 % | 4,98 | 4,25 | 1,58 s |
| **Pipecat** (OSS) | 63,41 % | 97,15 % | 4,97 | 3,74 | 1,97 s |
| **Vapi** | 59,76 % | 82,93 % | 4,73 | 4,08 | 3,08 s |
| Gemini Live | 30,49 % | 72,36 % | 4,97 | n/d | 3,05 s |
| Bland AI | sin benchmark independiente | | | | |

**Precios:** Vapi **$0,05/min** (solo orquestación; LLM/voz/telefonía aparte) · Bland **$0,09/min** all-in · Retell **$0,07–0,15/min** · ElevenLabs planes free–$99+/mes (+ modelo + telefonía).

**Twilio:** el patrón más repetido — número Twilio → WhatsApp → habilitar calling → TwiML → **SIP trunk** a ElevenLabs/Retell/Vapi/Bland (incluso *no-code* con n8n). Twilio aporta telefonía + `ConversationRelay`; el agente lo pone la plataforma de voz.

### 3.4 Cómo se conecta todo (mapa de la cadena de valor)

```
Meta Cloud API  ──(acceso/BSP)──►  360dialog / Twilio / BuilderBot-provider-meta
     │                                        │
     │ Calling API (SIP/WebRTC)               │ SIP / WebRTC
     ▼                                        ▼
  Agente IA de voz  ◄── Retell / ElevenLabs / LiveKit / Vapi / Pipecat / [BUILDERBOT]
     ▲
     └── Meta Business Agent (MBA): Meta mete su PROPIO agente en la capa de arriba
```

**Nuestra posición:** BuilderBot ya ocupa *dos* capas (acceso Meta **y** agente de voz/flujo). Eso es la ventaja y también el problema: competimos con Meta en su propia capa y con plataformas de voz especializadas en la de abajo.

---

## 4. Gap analysis priorizado

Prioridad por **impacto en competitividad** × **esfuerzo**. `S` ≤ 1 semana, `M` ≤ 1 mes, `L` > 1 mes (estimación gruesa, 1 dev senior).

### P0 — Bloqueante para competir

| # | Gap | Por qué importa | Esfuerzo | Notas de implementación |
|---|---|---|---|---|
| P0.1 | **Llamadas salientes** | Meta lo soporta y la competencia lo tiene. Sin esto solo servimos inbound. | **L** | `CallAction.Call` + SIP INVITE a `wa.meta.vc` (TLS, auth RFC 3261, SDP offer con ICE/DTLS-SRTP/OPUS). Requiere flujo CPR (permiso) + manejo de `statuses` RINGING/ACCEPTED/REJECTED. |
| P0.2 | **Barge-in / interrupción** | Los benchmarks ponen interrupción en 4,7–5,0/5. Sin esto se siente un bot de IVR viejo. | **M** | Al detectar voz entrante: cortar `pushFramesPaced` + `session.source`; desacoplar el playback del envío del flujo. |
| P0.3 | **Latencia realtime** | Competencia: 1,27–3,08 s. Nuestro pipeline por turnos (800 ms silencio + STT batch + TTS batch) queda por encima. | **L** | Streaming STT (Deepgram WS) + streaming TTS (Cartesia/ElevenLabs WS) o **OpenAI Realtime API**. Ya tenemos LiveKit como transporte; es la vía natural. |
| P0.4 | **DTMF / IVR** | Meta lo soporta; menús telefónicos son caso de uso central. | **M** | Parsear eventos DTMF del webhook → emitir al flujo como evento. |

### P1 — Necesario para producción

| # | Gap | Esfuerzo | Notas |
|---|---|---|---|
| P1.1 | Eventos de estado de llamada al flujo (`ringing/accepted/rejected/terminate`) | S | Hoy solo `notice`/`message`. Mapear `statuses` → eventos del bus. |
| P1.2 | **Saludo al conectar** (greeting) | S | Emitir `call_ready` en `accept OK` y disparar un flujo/`sendMessage`. |
| P1.3 | SIP para WhatsApp calling | M | Meta soporta SIP; reusar `provider-voice-sip`. |
| P1.4 | Grabación + transcripción persistida | M | Guardar PCM/transcript en DB (compliance, analytics, QA). |
| P1.5 | Transferencia a humano (warm/cold) | M | Requiere salientes (P0.1) o SIP. |
| P1.6 | Call settings API (icon, hours, SIP, deep links) | S | CRUD sobre `/settings`. |
| P1.7 | RAG + function calling / tools en el flujo | M | Hoy la IA es 100 % responsabilidad del dev. |

### P2 — Diferenciación

| # | Gap | Esfuerzo |
|---|---|---|
| P2.1 | Concurrencia + límites (1.000/WABA) + métricas/observabilidad | M |
| P2.2 | Simulador de llamadas + evaluación de calidad (tipo Cekura) | M |
| P2.3 | VAD avanzado, noise suppression, echo cancellation | M |
| P2.4 | Voces clonadas / catálogo de voces (ya hay 4 adapters TTS) | S |
| P2.5 | Analytics: resumen, sentimiento, KPIs por llamada | M |
| P2.6 | Detección automática de idioma / multi-idioma | S |

### P3 — Futuro

| # | Gap | Esfuerzo |
|---|---|---|
| P3.1 | Videollamada (Meta ya expone `video.status`) | M |
| P3.2 | Multi-canal unificado (voz + chat con mismo estado/memoria) | M |
| P3.3 | Conectores CRM / memoria larga | L |
| P3.4 | Guardrails / moderación de contenido de voz | M |

---

## 5. Scorecard de madurez (llamadas WhatsApp)

10 dimensiones × 5 checks. **0** = ausente · **0,5** = parcial · **1** = verificado en contrato acotado.

| Dimensión | Subtotal | Peso | Puntos |
|---|---|---|---|
| 1. Inbound (WebRTC/SDP) | 4,5 / 5 | 15 | 13,5 |
| 2. Pipeline STT/TTS | 3,5 / 5 | 15 | 10,5 |
| 3. Integración con flujos | 4,0 / 5 | 10 | 8,0 |
| 4. Turn-taking / barge-in | 0,5 / 5 | 15 | 1,5 |
| 5. Llamadas salientes | 0,0 / 5 | 15 | 0,0 |
| 6. IVR / DTMF | 0,0 / 5 | 10 | 0,0 |
| 7. Ciclo de vida / eventos | 2,0 / 5 | 5 | 2,0 |
| 8. Operación (grabación, métricas, escala) | 0,5 / 5 | 5 | 0,5 |
| 9. Testing / evidencia | 2,0 / 5 | 5 | 2,0 |
| 10. DX (docs, starters, settings) | 2,5 / 5 | 5 | 2,5 |
| **TOTAL** | | **100** | **≈ 40,5 / 100** |

> Es **madurez de evidencia y cobertura**, no probabilidad de fallo. El inbound está bien construido; el valor competitivo está en lo que falta (4, 5, 6).

### Aceptación live — NV (no verificada)

- [ ] Llamada WhatsApp real entrante → transcripción → respuesta de voz (requiere WABA + número elegible + Calling API habilitada).
- [ ] Prueba de latencia percibida (objetivo: < 2 s hasta el primer audio).
- [ ] Prueba de barge-in (bloqueada: P0.2 no implementado).

---

## 6. Roadmap propuesto

### Fase A — "Cerrar el producto inbound" (P0.2 + P0.4 + P1.1 + P1.2)
- Barge-in, DTMF, eventos de estado, saludo al conectar.
- Resultado: un agente inbound que se siente natural y soporta menús.
- **Esfuerzo: M–L** · Impacto: alto.

### Fase B — "Salientes" (P0.1 + P1.5 + P1.6)
- Outbound con CPR, transferencia a humano, gestión de settings.
- Resultado: paridad funcional con la competencia.
- **Esfuerzo: L** · Impacto: muy alto.

### Fase C — "Realtime" (P0.3 + P2.3 + P2.4)
- Streaming STT/TTS o OpenAI Realtime sobre LiveKit; VAD/echo; voces.
- Resultado: latencia < 2 s, competitiva con Retell/ElevenLabs.
- **Esfuerzo: L** · Impacto: muy alto.

### Fase D — "Operación y confianza" (P1.4 + P2.1 + P2.2 + P2.5)
- Grabación, métricas, simulador, analytics, escala.
- **Esfuerzo: M–L** · Impacto: medio-alto (requisito de compra enterprise).

### Fase E — "Diferenciación" (P1.7 + P3.x)
- RAG + tools, multi-canal, video, CRM.
- **Esfuerzo: L** · Impacto: estratégico.

### Decisión estratégica abierta (no técnica)

Meta Business Agent puede **comerse la capa de agente** en números gestionados por Meta. Opciones:
1. **Convivencia:** posicionar BuilderBot como capa de *orquestación + datos + multi-canal* por encima/debajo de MBA (tomar/release control vía Thread Control).
2. **Diferenciación por control:** self-hosted, sin costo por token de Meta, STT/TTS/LLM intercambiables, datos en tu infra.
3. **Ignorar:** alto riesgo a 12 meses.

> Recomendación: **1 + 2**. Implementar el handoff de Thread Control (tomar/release) es barato y convierte a MBA de amenaza en coexistencia.

---

## 7. Fuentes

- 360dialog — Meta Business Agent: `https://docs.360dialog.com/docs/mba/meta-business-agent`
- 360dialog — Calling (visión general y límites): `https://docs.360dialog.com/docs/messaging/calling`
- 360dialog — Configurar Calling API: `https://docs.360dialog.com/docs/messaging/calling/how-to-configure-calling-api`
- 360dialog — API Reference Calling: `https://docs.360dialog.com/docs/messaging-api/api-reference/calling`
- 360dialog — Outbound Calls (CPR, SIP INVITE a `wa.meta.vc`): `https://docs.360dialog.com/docs/messaging/calling/outbound-calls`
- 360dialog — Guía MBA (precio $2/1M tokens, standby/take-control): `https://360dialog.com/blog/meta-business-agent-complete-guide-whatsapp-api/`
- Benchmark de plataformas de voz (Cekura Bench vía Retell): `https://www.retellai.com/blog/retell-vs-bland-vs-vapi-vs-elevenlabs`
- Alternativas a Vapi / opciones OSS (LiveKit, Pipecat): `https://orb-ui.com/blog/vapi-alternatives`
- Twilio + SIP trunk a agente IA (patrón de integración): `https://www.youtube.com/watch?v=qz8e0uXVg6E`
- Meta — WhatsApp Business Calling API (docs oficiales): `https://developers.facebook.com/docs/whatsapp/cloud-api/calling/`
