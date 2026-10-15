# Fase C — Llamadas WhatsApp: análisis 3-POV (verificado contra código)

| Field | Value |
|---|---|
| Fecha | 2026-10-06 |
| Fase | **C — "Realtime / latencia"** (del plan `docs/audits/voice-calls-plan-2026-10-06.md`) |
| Ítems | C1 Streaming STT · C2 Streaming TTS + playback incremental · C3 Patrón LLM streaming · C4 OpenAI Realtime API · C5 Vía LiveKit Agents · C6 VAD/noise · C7 Voces |
| Paquetes afectados | `provider-voice` (adapters + ambos cores), `provider-meta` (config) |
| POV | Consumidor API · Maintainer · Operador + Veredicto |
| Meta de latencia | **< 2 s** hasta el primer audio (benchmark competencia: ElevenLabs 1,27 s · Retell 2,21 s · Vapi 3,08 s) |
| Qué NO cubre | Medición live de latencia real — **NV** |

---

## 0. Verificación previa (hechos confirmados en código)

1. **Todo es batch**: `ISttAdapter.transcribe(pcm) → Promise<string>` y `ITtsAdapter.synthesize(text) → Promise<Buffer>` (`adapters/index.ts`) — PCM completo entra, texto/audio completo sale. No hay streaming en las interfaces.
2. **Deepgram STT va por REST** (`adapters/stt/deepgram.ts:67`, `POST /v1/listen`), no por WebSocket. **ElevenLabs TTS usa el endpoint `/stream` pero colecciona todo a Buffer** (`adapters/tts/elevenlabs.ts:62-63`) — no es playback incremental.
3. **Cadena de latencia actual por turno** (calls/core.ts):
   - Espera de silencio final: `silenceMs` = **800 ms fijo** (`core.ts:164`).
   - STT batch (Whisper/Deepgram REST): ~0,5–2 s.
   - LLM del dev: ~0,5–3 s+ (fuera de nuestro paquete, pero dentro del turno).
   - TTS batch: ~0,5–2 s.
   - Playback *paced* a tiempo real (`pushFramesPaced`, `core.ts:630`).
   - **Total típico: 2,5–7 s** hasta el primer audio. Peor que toda la competencia medida.
4. **`utteranceQueue` serializa STT por llamada** (`core.ts:555`) — bien para orden, pero suma latencia si se encolan utterances.
5. **Ambos cores comparten el patrón batch**: `calls/core.ts` (WhatsApp) y `voice/core.ts` (LiveKit) usan `SilenceSegmenter` + batch STT/TTS (`voice/core.ts:126, 178-205`). Una mejora de streaming beneficia a los dos.
6. **VAD actual = RMS por frame** (`frameRms`, `audio.ts:49`) — primitivo; sin modelo de voz real.
7. **Eco**: nuestro audio saliente NO está en el track entrante (es el mic del llamante); la AEC la hace el cliente WhatsApp. Riesgo residual: altavoz con AEC pobre → falsos barge-in (mitigado con debounce de A1).
8. **La Queue del bot no es cuello**: tras RFC 0004 hay wakeup + `timeout` por flujo; pero cada write a DB (mongo/postgres) suma ms por mensaje.

### Presupuesto de latencia objetivo (streaming)

| Tramo | Hoy (batch) | Objetivo (streaming) |
|---|---|---|
| Endpointing (fin de turno) | 800 ms fijo | ~300 ms (VAD+endpointing server-side) |
| STT | 0,5–2 s (tras callar) | corre en paralelo al habla; final ~200 ms tras endpointing |
| LLM (dev) | 0,5–3 s | streaming: primera frase ~300–500 ms |
| TTS | 0,5–2 s (texto completo) | primer chunk ~200–300 ms (WS) |
| **Primer audio** | **2,5–7 s** | **≈ 1–1,5 s** ✅ |

---

## C1. Streaming STT (WebSocket)

| POV | Análisis |
|---|---|
| **Consumidor API** | Nueva interfaz `IStreamingSttAdapter` (eventos `interim` / `final` / `utterance_end`); el flujo sigue recibiendo `message` con el transcript final — **cero cambio de DX**. Bonus: exponer `interim` como evento opcional para UI/"escuchando…". |
| **Maintainer** | Adapter Deepgram WS (`wss://api.deepgram.com/v1/listen`) con endpointing server-side (reemplaza el `silenceMs` fijo por detección de fin de turno). Core: `wireAudioSink` alimenta el socket además del segmenter; `utterance_end` dispara `handleUtterance` sin esperar 800 ms. Mantener batch como fallback (`sttMode: 'batch' \| 'stream'`). Tests: mock WS. Riesgo: gestión de reconexión del socket y backpressure de frames. |
| **Operador** | Un WS por llamada activa → coste/conexiones concurrentes a vigilar (1.000/WABA = 1.000 sockets). Deepgram factura por minuto streamed. Reconexión + heartbeat. Métrica: distribución de endpointing delay. |
| **Veredicto** | ✅ Hacer. Esfuerzo **M**. Impacto alto (recorta ~1,3 s fijos). Prerequisito natural de C2. |

---

## C2. Streaming TTS + playback incremental

| POV | Análisis |
|---|---|
| **Consumidor API** | Transparente: `sendMessage`/`flowDynamic` igual. Internamente el audio empieza a sonar en ~300 ms en vez de esperar la síntesis completa. |
| **Maintainer** | (a) `IStreamingTtsAdapter.synthesizeStream(text) → AsyncIterable<Buffer>` (Cartesia WS, ElevenLabs WS). (b) Playback incremental: hoy `publishAudio` sintetiza TODO y luego `pushFramesPaced`; hay que alimentar frames a medida que llegan (cola productor-consumidor con el mismo pacing de `PUBLISH_FRAME_MS`). Integra con barge-in (A1): cancelar = dejar de consumir la cola. (c) Fraseo: sintetizar por frases (el LLM devuelve oraciones; no esperar el párrafo completo). Tests: stream mock + pacing. |
| **Operador** | WS por llamada (igual que C1). Cartesia/ElevenLabs: límites de concurrencia por plan. `playback_interrupted` debe drenar la cola de chunks pendientes. |
| **Veredicto** | ✅ Hacer. Esfuerzo **M**. Junto con C1 es el grueso de la mejora de latencia. |

---

## C3. Patrón LLM streaming (lado del dev)

| POV | Análisis |
|---|---|
| **Consumidor API** | Helper/receta: LLM streaming → por cada oración completa, `flowDynamic(oración)` (voz) — cada una es un `publishAudio` incremental que con C2 suena casi inmediato. Documentar "frases cortas, 1–2 oraciones" (mejor para voz y para TTS). |
| **Maintainer** | Nada estructural: `flowDynamic` ya permite múltiples envíos por turno. Considerar helper `streamDynamic(asyncIterable)` en `@builderbot/bot` que frasee y envíe — **decisión de API pública del core, discutir aparte** (no colar en Fase C sin RFC propio). |
| **Operador** | Cuidado: cada `flowDynamic` persiste en DB (mongo/postgres suman latencia por write). Para voz, ofrecer `saveHistory: false` o similar en el helper. |
| **Veredicto** | ✅ Doc + receta ahora (**S**); helper `streamDynamic` → **RFC aparte** (no en Fase C). |

---

## C4. OpenAI Realtime API (speech-to-speech) — decisión de producto

| POV | Análisis |
|---|---|
| **Consumidor API** | Sería el modo "llamada IA nativa": VAD, barge-in, STT+LLM+TTS en una sola sesión WebSocket, ~1 s de respuesta. **Pero bypass al motor de flujos**: la conversación la maneja Realtime con instructions+tools; los keywords/flows/DB de BuilderBot quedan fuera salvo vía function-calling. |
| **Maintainer** | Arquitectura distinta: provider que puentea el track WebRTC de Meta ↔ sesión Realtime (audio PCM16 24 kHz). Los "flows" se re-expresan como tools (function calling → `bot.dispatch`). Es casi un provider nuevo (`provider-voice-realtime`?). No destruye lo existente: convive como modo alternativo. Esfuerzo **L**. |
| **Operador** | Coste: Realtime API factura por tokens de audio (caro vs Whisper+GPT-4o-mini+TTS). Dependencia total de OpenAI para esa llamada. Menos knobs propios (VAD server-side de OpenAI). |
| **Veredicto** | 🟡 **No en Fase C**. Es un **modo producto alternativo** (flow-driven vs AI-native) que merece RFC propio y validación de demanda. C1+C2 ya nos acercan a ~1,2 s sin cambiar el modelo mental de BuilderBot. |

---

## C5. Vía LiveKit Agents (converge con Fase B3/SIP)

| POV | Análisis |
|---|---|
| **Consumidor API** | Si B3 (SIP→LiveKit) funciona, la llamada entra a un room y `provider-voice`/LiveKit Agents dan streaming STT/TTS, turn-detection, interrupción y **noise cancellation** (plugin cloud) out-of-the-box. |
| **Maintainer** | LiveKit Agents es framework aparte (Python/Node). Integrarlo es adoptar otro runtime para el agente; nuestro `provider-voice` actual es manual (segmenter+batch). Alternativa: portar solo las piezas (turn detection) sin adoptar el framework completo. |
| **Operador** | LiveKit Cloud o self-hosted; Enhanced Noise Cancellation es feature cloud (coste). Una capa más de infra. |
| **Veredicto** | 🟡 Condicionado a **B3=Go**. Si SIP/LiveKit entra, reevaluar C1/C2: quizá salen "gratis" con LiveKit Agents y no hay que construirlos sobre wrtc. **No duplicar trabajo: decidir B3 antes de implementar C1/C2 a fondo.** |

---

## C6. VAD avanzado / noise suppression

| POV | Análisis |
|---|---|
| **Consumidor API** | Mejor endpointing = menos "me cortaste" y menos esperas. Transparente. |
| **Maintainer** | Opciones: (a) endpointing de Deepgram WS (gratis con C1) — recomendado; (b) Silero VAD en WASM (onnxruntime-node) como adapter local — M; (c) quedarse con RMS+debounce (hoy). No construir VAD propio si C1 lo cubre. |
| **Operador** | VAD local (b) evita dependencia/cloud; VAD cloud (a) ya se paga con el STT. |
| **Veredicto** | ✅ Cubierto por C1 (endpointing Deepgram). Silero local = opcional **P2**. Esfuerzo **S** si es solo configuración de C1. |

---

## C7. Catálogo de voces / clonación

| POV | Análisis |
|---|---|
| **Consumidor API** | Ya hay 4 adapters TTS con `voiceId`/modelo configurables. Clonación = feature de cuenta en ElevenLabs/Cartesia (fuera del paquete). Falta: doc "elegí voz" + ejemplos por idioma. |
| **Maintainer** | Nada de código; tal vez exponer `voice` en el config de alto nivel de provider-meta (hoy los adapters se inyectan). |
| **Operador** | — |
| **Veredicto** | ✅ Docs (**S**). Empaquetar con Fase C. |

---

## Plan Fase C alineado (orden por valor/riesgo)

| Ola | Contenido | Depende de | Riesgo | Esfuerzo |
|---|---|---|---|---|
| **C-W1** | C1 streaming STT (Deepgram WS + endpointing) + C6 (viene gratis) + `sttMode` fallback batch | Fase A | Medio | M |
| **C-W2** | C2 streaming TTS (Cartesia/ElevenLabs WS) + playback incremental (integra con barge-in A1) | C-W1 | Medio | M |
| **C-W3** | C3 receta LLM streaming + C7 doc de voces | C-W2 | Bajo | S |
| **C-W4** | **Spike live latencia** (medir primer-audio en llamada real; objetivo < 2 s) | C-W2 | Alto (externo) | S |
| **C-W5** | Reevaluación: ¿LiveKit Agents (C5) o OpenAI Realtime (C4)? → RFC propio si procede | B3 spike | — | S (decisión) |

## Registro de sorpresas eliminadas

1. ~~"Streaming = cambiar la API pública"~~ → las interfaces actuales son batch, pero se añade `IStreamingSttAdapter`/`IStreamingTtsAdapter` **sin romper** (`sttMode: 'batch'|'stream'`); el flujo sigue recibiendo `message`.
2. ~~"Deepgram ya streamea"~~ → el adapter actual es **REST** (`/v1/listen`), no WS. Hay que construirlo.
3. ~~"ElevenLabs /stream ya es incremental"~~ → se **colecciona entero a Buffer** antes de reproducir (`elevenlabs.ts:62-63`). Hay que hacerlo incremental de verdad.
4. ~~"Realtime API es un upgrade"~~ → es **otro modelo de producto** (bypass del motor de flujos). Decisión de producto, no de refactor.
5. ~~"VAD propio"~~ → Deepgram WS trae endpointing server-side; no construir VAD si C1 lo cubre.
6. ~~"El eco es problema nuestro"~~ → la AEC la hace el cliente WhatsApp; nuestro riesgo residual es altavoz con AEC pobre (debounce de A1 lo absorbe).
7. ~~"Latencia = solo STT/TTS"~~ → los writes de DB por mensaje (mongo/postgres) y el LLM del dev también cuentan; la receta C3 lo documenta.
8. **Dependencia cruzada**: si B3 (SIP→LiveKit) = Go, C5 puede hacer C1/C2 redundantes → **ordenar spikes: B3 antes de C-W1/C-W2 a fondo**.

## Aceptación live — NV (pendiente)

- [ ] NV1: latencia primer-audio medida en llamada real (objetivo < 2 s; registrar p50/p95).
- [ ] NV2: endpointing correcto en español con ruido de calle (sin cortes prematuros).
- [ ] NV3: barge-in (A1) + streaming TTS (C2) conviviendo (interrumpir a mitad de chunk).
- [ ] NV4: 10 llamadas concurrentes con WS STT/TTS (estabilidad de sockets).

---

## Fuentes

- Repo: `packages/provider-voice/src/adapters/index.ts`, `adapters/stt/{openai,deepgram}.ts`, `adapters/tts/{elevenlabs,cartesia}.ts`, `src/calls/core.ts` (silenceMs:164, utteranceQueue:555, pushFramesPaced:630), `src/voice/core.ts` (batch:126,178-205), `src/audio.ts` (frameRms:49).
- Benchmarks competencia (Cekura Bench vía Retell): `https://www.retellai.com/blog/retell-vs-bland-vs-vapi-vs-elevenlabs`.
- Alternativas/LiveKit/Pipecat/Realtime: `https://orb-ui.com/blog/vapi-alternatives`.
