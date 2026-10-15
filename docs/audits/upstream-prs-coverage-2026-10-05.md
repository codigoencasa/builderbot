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

---

## 5. Análisis 3-POV de cada punto (verificado contra código)

> Verificación previa (2026-10-05): `sharp@0.33.3` exige `node ^18.17.0 || ^20.3.0 || >=21.0.0`
> (+ `libvips >= 8.15.2`); root pide `node >=18`; Meta **sí** expone `fromMe` en raíz
> (`processIncomingMsg.ts:205`; el audit sintético lo omitió por no pasar el parámetro);
> el core **no tiene evento CONTACTS** (`LIST_ALL` = WELCOME/MEDIA/LOCATION/DOCUMENT/
> VOICE_NOTE/ACTION/ORDER/TEMPLATE/CALL); Baileys ya filtra auto-mensajes vía
> `writeMyself` (`bailey.ts:847-855`) pero no expone `fromMe` en raíz.

### P1. `engines` en `provider-baileys`

| POV | Análisis |
|---|---|
| **Consumidor API** | `engines` solo avisa en install (error si `engine-strict`). El valor del PR #1259 (`>=20.12.1`) es **incorrecto**: bloquearía Node 18.17/20.3-20.12 sin motivo. El suelo real es el de sharp: `^18.17.0 \|\| ^20.3.0 \|\| >=21.0.0`. |
| **Maintainer** | Coherencia: root `>=18`, CONTRIBUTING 20+, CI 22. El valor debe copiar el de `sharp@0.33.3`, no inventarse. Documenta también `libvips >= 8.15.2`. |
| **Operador** | Fallo típico en producción: sharp/libvips binario incompatible al arrancar. `engines` correcto da señal temprana en CI/deploy; incorrecto rompe deploys válidos. |
| **Veredicto** | ✅ Hacer, con el rango **real de sharp**, no el del PR. Esfuerzo trivial, riesgo bajo. |

### P2. `notice` de webhook en Meta (de #1259)

| POV | Análisis |
|---|---|
| **Consumidor API** | DX real: recuerda configurar el webhook. No rompe nada (evento ignorable). Ya hay convención: meta emite `notice` en errores (`provider.ts:124`) y baileys también (`bailey.ts:1179`). |
| **Maintainer** | Seguir el shape existente `{title, instructions[]}`. Debe emitirse **una vez** (tras `ready`), no en cada reconexión. |
| **Operador** | `notice` suele ir a consola; si se emite por reconexión es ruido en logs. Gate: flag de "ya emitido" por proceso. |
| **Veredicto** | ✅ Hacer, una sola vez por proceso. Esfuerzo pequeño + test. |

### P3. `fromMe` en raíz (Baileys)

| POV | Análisis |
|---|---|
| **Consumidor API** | Habilita `if (ctx.fromMe) return` sin conocer `key.fromMe`. Aditivo. Conecta con el objetivo de #1258 (filtro de auto-respuestas) sin tocar core. |
| **Maintainer** | **Corrección:** Meta ya lo expone (`processIncomingMsg.ts:205`); falta solo Baileys. Un campo derivado de `key.fromMe`, test incluido. Encaja en Fase 2 del RFC 0003. |
| **Operador** | Baileys ya mitiga loops con `writeMyself`; Meta casi nunca entrega mensajes propios por webhook. Riesgo nulo, valor de observabilidad. |
| **Veredicto** | ✅ Hacer (solo Baileys), aditivo. RFC 0003 §2.1/2.3 ya corregido. |

### P4. `pushName ?? profile.username` en Meta (de #1244)

| POV | Análisis |
|---|---|
| **Consumidor API** | Usuarios solo-username (sin `profile.name`) hoy llegan como `name: 'Unknown'`. El fallback da un nombre usable. Aditivo. |
| **Maintainer** | Una línea en `core.ts:298` + test. Alineado con el rollout de usernames de Meta. |
| **Operador** | Sin impacto. |
| **Veredicto** | ✅ Trivial. Empaquetar con P2 (misma zona de Meta). |

### P5. Refs `_event_contacts_` y poll en Baileys

| POV | Análisis |
|---|---|
| **Consumidor API** | Hoy `ctx.body` es `undefined` para contacto/poll en Baileys (el flujo no puede matchear). Ojo: **Meta tiene el mismo hueco estructural** — emite `_event_contacts_` pero el core no tiene evento CONTACTS, así que tampoco matchea. |
| **Maintainer** | Orden correcto: (a) evento CONTACTS en core (`eventContacts.ts` + `LIST_ALL`/`LIST_REGEX`) — es la parte core de #1244, hecha limpia; (b) emitir `_event_contacts_` en Baileys. Poll: no hay evento POLL en core y en Baileys los resultados llegan por `messages.update`; requiere diseño nuevo → **diferir** a RFC 0003. |
| **Operador** | Evento nuevo en core es aditivo; flujos que no lo usan no se ven afectados. |
| **Veredicto** | 🟡 Dividir: **P5a** CONTACTS (core + Baileys) ahora; **P5b** poll → RFC 0003. |

## 6. Plan alineado (orden por valor/esfuerzo/riesgo)

| Ola | Contenido | Paquetes | Riesgo |
|---|---|---|---|
| **W1** (trivial, sin core) | P1 `engines` (rango real) + P3 `fromMe` (baileys) + P4 `pushName` fallback + P2 `notice` una vez | `provider-baileys`, `provider-meta` | Bajo |

**Estado W1: ✅ implementado** (rama `fix/w1-provider-dx-backlog`). Detalles:
- P1: `engines.node = "^18.17.0 || ^20.3.0 || >=21.0.0"` en `provider-baileys/package.json`
  (rango real de `sharp@0.33.3`, no el `>=20.12.1` del PR #1259).
- P3: `fromMe: Boolean(key.fromMe)` en la raíz del payload de Baileys (`bailey.ts`).
- P4: `pushName ?? profile.username ?? 'Unknown'` en `provider-meta/src/meta/core.ts`.
- P2: `notice` "🔗 WEBHOOK REQUIRED" emitido **una vez por proceso** tras `ready`
  (`provider-meta/src/meta/provider.ts`, flag `webhookNoticeEmitted`).
- Tests: 3 nuevos (fromMe raíz; notice-once; fallback de pushName). Suites: baileys 231/231, meta 160/160. Lint y build limpios.
| **W2** (core) | P5a evento CONTACTS en core + ref `_event_contacts_` en Baileys | `bot`, `provider-baileys` | Bajo-medio |

**Estado W2: ✅ implementado** (rama `fix/w2-contacts-event`). Detalles:
- Core: nuevo `packages/bot/src/io/events/eventContacts.ts` (`eventContacts` + `REGEX_EVENT_CONTACTS`),
  registrado en `LIST_ALL.CONTACTS` y `LIST_REGEX.REGEX_EVENT_CONTACTS`; `coreClass.ts` añade el bloque
  de routing `REGEX_EVENT_CONTACTS → listEvents.CONTACTS` junto a los demás eventos.
- Baileys: `contactMessage` y `contactsArrayMessage` emiten `body = _event_contacts_<uuid>`
  (antes `undefined`). Meta ya emitía ese ref; ahora por fin matchea un evento del core.
- Tests: 4 nuevos en `bot` (42/42 en events), 1 en baileys (espiando `generateRefProvider`,
  pues la suite usa automock de `@builderbot/bot`), suite meta sin cambios (160/160, el test de
  contacts ya existente sigue pasando). Suites completas: baileys 232/232, bot 181/181 (6 skipped
  preexistentes), meta 160/160. Builds de `bot` y `provider-baileys` OK.
- Bonus: `eslint --fix` en `events.test.ts` corrigió 9 errores de `import/order` **preexistentes**.
| **W3** (contrato) | RFC 0003 envelope (requiere las 4 decisiones) + P5b poll | `bot`, ambos providers | Medio |

Dependencias: W2 antes que cualquier ref de contactos; W3 requiere aprobación de las
decisiones del RFC 0003 (type/messageId/to/raw).
