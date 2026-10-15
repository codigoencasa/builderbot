# RFC 0004 — `@builderbot/bot`: fix del auto-deadlock re-entrante de `Queue`

| Field | Value |
|---|---|
| Status | **Implemented — Fases 1 a 5** (pendiente de review/merge) |
| Author | Engineering (agent-assisted) |
| Issue | `Queue item timeout after 50000ms` intermitente (~1/3) en flujos con continuación |
| Provenance | Análisis de `packages/bot/src/utils/queueClass.ts` + `core/coreClass.ts` (verificado contra fuente, no contra el bundle) |
| Reviewers | Maintainer (`@leifermendez`) |
| Target version | `1.4.4` → `1.4.5` (patch; sin cambios de API) |
| Risk | Bajo. Un solo archivo de producción modificado. Revertible con `git revert` |
| Baseline | `@builderbot/bot@1.4.4`, suite UVU del paquete verde |

**Estado de implementación (Fases 1 a 5):** aplicado en `packages/bot/src/utils/queueClass.ts` (Fase 1: ventana deslizante + wakeup; Fase 2: timers por `from` + `clearAndDone` deduplicado; Fase 3: re-entrada con `AsyncLocalStorage`; Fase 4: señal de cancelación cooperativa + `clearAll()`; Fase 5: timeout por item), en `packages/bot/src/core/coreClass.ts` (Fase 3: `stop()`; Fase 4: chequeo de `signal.cancelled`; Fase 5: pasa `options.timeout` a la cola), en `packages/bot/src/types.ts` + `src/io/methods/addAnswer.ts` (Fase 5: `timeout` en `ActionPropertiesKeyword`) y en `packages/bot/__mock__/env.ts` (Fase 5: teardown hace `stop()`). Evidencia: gates bidireccionales verificados; suite `@builderbot/bot` 208/208 verde (1 skip pre-existente); soak unidades ×20 sin fallos; e2e sin regresión de duración; prettier/eslint/build OK.

---

## 1. Summary

**Problem.** `Queue.processQueue` drena la cola por lotes con `await Promise.all(batch)`. Cuando el trabajo de un item **encola y awaita otro item del mismo `from`** (cadena real: `cbEveryCtx → callback del flujo → continueFlow/gotoFlow → sendFlow → enqueueMsg`), el item nuevo queda en `queueByFrom` pero el loop de drenado está bloqueado esperando al batch que contiene al item padre. Resultado: **A espera a B, B espera a A** → deadlock hasta que el timer de 50 s rechaza con `Queue item timeout after 50000ms`. La intermitencia viene de `continueFlow` (`coreClass.ts:356-357`): solo encola si `database.getPrevByNumber(from)` tiene `keyword` y hay mensajes de continuación — depende del estado/timing, no del batching.

**Proposal.** Reemplazar el drenado por lotes bloqueantes por una **ventana deslizante (sliding window / worker-pool por `from`)**: mantener hasta `concurrencyLimit` items en vuelo y, cada vez que se libera un slot, tomar el siguiente item FIFO de la cola. Un item encolado re-entrantemente obtiene slot inmediatamente → el deadlock desaparece por construcción.

**Impact.** Se elimina el timeout espurio de 50 s sin cambiar: orden de inicio FIFO, límite de concurrencia, resolución `'success'`, rechazo por timeout, semántica silenciosa de `clearQueue`, ni una sola línea de `coreClass.ts`.

---

## 2. Motivación — evidencia verificada

| ID | Hallazgo | Evidencia | Fase |
|---|---|---|---|
| Q1 | Batch bloqueante: `splice(0, concurrencyLimit)` + `await Promise.all(...)`; el `while` no re-chequea hasta que todo el batch resuelve | `queueClass.ts:148-157` | 1 |
| Q2 | `enqueue` no arranca `processQueue` si `workingOnPromise.get(from) === true` | `queueClass.ts:140-144` | 1 |
| Q3 | El trabajo del item awaita la cadena `resolveCbEveryCtx → cbEveryCtx → allCallbacks[inRef]` que puede terminar en `enqueueMsg(from, …)` (mismo `from`) y awaita su resolución | `coreClass.ts:333-352`, `354-390`, `549-624` | 1 |
| Q4 | `flowDynamic` **no encola** (envía directo con `sendProviderAndSave`); quien encola es `continueFlow` (default `options.continue: true`) y `gotoFlow` | `coreClass.ts:452-517` | — (precisión del diagnóstico) |
| Q5 | `timers` es global keyado por `fingerIdRef`: un item puede cancelar el timer de otro | `queueClass.ts:97-100` | 2 |
| Q6 | `clearQueue(from)` limpia **todos** los timers globales, incluidos items en vuelo de otros `from` | `queueClass.ts:178-183` | 2 |
| Q7 | `clearAndDone` se ejecuta dos veces por item (`cancel()` + `.finally`) | `queueClass.ts:103-107`, `152` | 2 |
| Q8 | ~~Race de cierre~~ **DESCARTADO**: entre la salida del loop de drenado y `workingOnPromise.set(from, false)` no hay `await`, y `clearQueue` corre síncrono (sin `await` interno); un `enqueue` solo puede intercalarse en un punto de suspensión, por lo que no puede quedar huérfano. No es un race alcanzable | análisis de atomicidad sobre `queueClass.ts` | — (descartado) |
| Q9 | **Hallazgo durante la implementación:** una ventana deslizante ingenua (sliding window con `await Promise.race(inFlight)`) **no basta**. Si el pump espera a que termine algún item en vuelo y el único item que desbloquearía a A es B (encolado, no in-flight), nadie despierta al pump → deadlock persiste. Se requiere un **wakeup** explícito que notifique al pump al encolar un item nuevo | verificado con `queue.reentrant.test.ts` en el gate bidireccional | 1 |

Secuencia del deadlock (verificada):

```
handleMsg → sendFlow → enqueue(from, A)
  → processQueue: batch=[A], await Promise.all([A])
    → A.promiseInFunc: sendProviderAndSave → resolveCbEveryCtx → callback del flujo
      → await flowDynamic(...) → continueFlow() → sendFlow → await enqueueMsg(from, B)
        → B push a queueByFrom; workingOnPromise=true → NO se procesa
    → A awaita B; el loop awaita A  ⇒  deadlock
  → 50 s: timer de A rechaza → "Queue item timeout after 50000ms"
```

---

## 3. Goals / Non-goals

**Goals**
- G1. Eliminar el deadlock re-entrante para cualquier profundidad de re-entrada `< concurrencyLimit`.
- G2. Preservar el 100% de la semántica observable actual (ver §4, invariantes I1–I7).
- G3. Toda la suite UVU de `@builderbot/bot` (unit + e2e) verde **sin modificar un solo test existente**.
- G4. Test de regresión que falle antes del fix y pase después.

**Non-goals**
- No tocar `coreClass.ts`, `flowDynamic`, `continueFlow`, ni la cadena de envío.
- No cambiar defaults (`timeout: 50000`, `concurrencyLimit: 15`) ni la firma pública de `Queue`.
- No arreglar Q8 (race de cierre) ni agregar `stop()` a `CoreClass`: follow-ups separados.
- No refactorizar `idsCallbacks` ni la deduplicación por `fingerIdRef`.

---

## 4. Invariantes (contrato que el fix debe preservar)

| # | Invariante | Garantizado por |
|---|---|---|
| I1 | `enqueue(from, fn, ref)` resuelve `'success'` al completar el item | `processItem` → `item.resolve('success')` (sin cambios) |
| I2 | Timeout rechaza con `Error` cuyo mensaje incluye `timeout` | `Promise.race` + timer por item (sin cambios) |
| I3 | Duplicado de `fingerIdRef` pendiente resuelve `'success'` inmediato | chequeo `findIndex` en `enqueue` (sin cambios) |
| I4 | `clearQueue(from)` retorna 0 y resuelve pendientes silenciosamente como `'success'` | cuerpo de `clearQueue` (sin cambios en Fase 1) |
| I5 | Orden de **inicio** FIFO por `from` | `shift()` estricto sobre `queueByFrom` |
| I6 | Concurrencia por `from` ≤ `concurrencyLimit` en todo instante | guard `inFlight.size < this.concurrencyLimit` antes de cada `shift` |
| I7 | `processItem` nunca rechaza (try/catch interno → `item.reject`) → las promesas de `inFlight` siempre resuelven | código existente; premisa de seguridad del `Promise.race` |

---

## 5. Diseño propuesto (Fase 1)

### 5.1 Cambio único: `processQueue` en `packages/bot/src/utils/queueClass.ts`

Dos piezas: (a) ventana deslizante en `processQueue`; (b) canal de **wakeup** por `from` para que `enqueue` despierte al pump cuando agrega un item.

```ts
// nuevo campo
private wakeups: Map<string, () => void>

private notifyQueue(from: string): void {
    const wake = this.wakeups.get(from)
    if (wake) {
        this.wakeups.delete(from)
        wake()
    }
}

async enqueue(from, promiseInFunc, fingerIdRef) {
    // ...push del item...
    queueByFrom.push({ promiseFunc, fingerIdRef, cancelled: false, resolve, reject })
    this.notifyQueue(from) // ← despierta al pump si está esperando
    if (!workingByFrom) { this.processQueue(from); this.workingOnPromise.set(from, true) }
}

async processQueue(from: string): Promise<void> {
    const queueByFrom = this.queue.get(from)!
    const inFlight = new Set<Promise<void>>()

    while (queueByFrom.length > 0 || inFlight.size > 0) {
        // Llenar slots libres respetando FIFO (I5) y el límite de concurrencia (I6)
        while (queueByFrom.length > 0 && inFlight.size < this.concurrencyLimit) {
            const item = queueByFrom.shift()!
            const p: Promise<void> = this.processItem(from, item).finally(() => {
                this.clearAndDone(from, item)
                inFlight.delete(p)
                this.notifyQueue(from) // ← avisa al pump que se liberó un slot
            })
            inFlight.add(p)
        }
        // Esperar slot libre O item nuevo. No hay await entre el guard y el registro del
        // wakeup → no se pierde ninguna notificación en esa ventana.
        if (inFlight.size > 0) {
            await new Promise<void>((resolve) => this.wakeups.set(from, resolve))
        }
    }

    // Sin await entre el último chequeo de cola vacía y este set → atómico en JS (Q8 no empeora)
    this.workingOnPromise.set(from, false)
    await this.clearQueue(from)
}
```

Diff conceptual: `splice(0, N)` + `await Promise.all(batch)` → `shift()` incremental + canal de wakeup. `clearQueue` y el resto del archivo quedan igual en Fase 1.

### 5.2 Prueba de corrección (argumento formal)

**Terminación (liveness).** Sea B un item encolado re-entrantemente desde A, con el pump esperando en el wakeup:
1. `enqueue(B)` llama a `notifyQueue(from)` tras el `push` → si el pump está esperando, resuelve su wakeup → el pump reevalúa.
2. En la nueva iteración, si `|inFlight| < concurrencyLimit`, el inner-while hace `shift()` de B y lo arranca. Si `|inFlight| = concurrencyLimit`, B espera a que **algún** item termine; como los items en vuelo no dependen todos de B (re-entrada < 15 niveles por G1), al menos uno termina → su `.finally` llama a `notifyQueue` → el pump reevalúa → B arranca.
3. B no depende de ningún item posterior (FIFO) → B termina → la continuación de A se desbloquea → A termina.
4. El loop externo solo sale con cola vacía **y** `inFlight` vacío → ningún item queda huérfano dentro del loop. ∎

**Ausencia de lost-wakeup.** El pump solo se suspende cuando `inFlight.size > 0`, y todo item en vuelo notifica al terminar. Además, entre el guard `inFlight.size > 0` y `wakeups.set(from, resolve)` no hay `await` (el executor del `Promise` corre síncrono), por lo que ninguna notificación puede intercalarse en esa ventana. ∎

**Seguridad (safety).**
- I6: el inner-while solo hace `shift()` si `inFlight.size < concurrencyLimit`; `inFlight.add` es la única vía de crecimiento y ocurre tras el guard. ∎
- I5: `queueByFrom` es FIFO (`push` en `enqueue`, `shift` aquí); ningún item adelanta a otro en arranque. ∎
- Ausencia de `unhandledRejection`: `processItem` captura todo (I7); `Promise.race(inFlight)` observa cada promesa. ∎
- Atomicidad del cierre: `Promise.race` resuelve después de que el `.finally` del item ejecutó `inFlight.delete` (el promise encadenado settlea post-callback); entre el chequeo `queueByFrom.length === 0 && inFlight.size === 0` y `workingOnPromise.set(from, false)` no hay `await` → ningún `enqueue` puede intercalarse en esa ventana. La ventana residual es la pre-existente Q8, idéntica a la de hoy. ∎

**Complejidad.** Tiempo: O(items) `shift` + O(items) carreras sobre un set de tamaño ≤ 15 → O(items × concurrencyLimit) peor caso acotado por constante 15; memoria O(concurrencyLimit). Sin regresión respecto a hoy (O(items) + batch arrays).

### 5.3 Por qué NO las alternativas

| Alternativa | Descartada porque |
|---|---|
| `enqueueMsg` fire-and-forget (no awaitar el `enqueue` en `coreClass`) | Rompe el orden estricto de mensajes dentro de un `sendFlow` (hoy el `await` serializa; sin él, 15 envíos concurrentes pueden reordenarse en el provider) y cambia semántica de `coreClass` |
| "Consumir de a uno y re-chequear length" (fix del informe original) | **No arregla nada**: si `processItem(A)` se awaita y A awaita B, el loop sigue bloqueado en A. Deadlock idéntico |
| Ventana deslizante sin wakeup (solo `Promise.race(inFlight)`) | **Insuficiente**: el pump espera a que termine un item en vuelo; si B (encolado, no in-flight) es lo único que desbloquearía a A, nadie despierta al pump. Verificado (Q9). Requiere el canal de wakeup |
| Subir `queue.timeout` | Solo retrasa el síntoma; el deadlock sigue |
| `AsyncLocalStorage` para detectar re-entrada y ejecutar inline | Complejidad alta, cambia el contexto de ejecución del callback, riesgo de efectos colaterales en providers |
| Re-implementar con `p-queue` u otra dep | Nueva dependencia de runtime, semántica de timeout/clearQueue distinta → reescritura de tests |

---

## 5bis. Fase 3 — deadlock a profundidad ≥ `concurrencyLimit` — **IMPLEMENTADA**

**Problema.** Con la ventana deslizante + wakeup (Fase 1), si los `concurrencyLimit` slots están ocupados por items que **todos** awaitan un hijo encolado, ningún padre completa y ningún hijo arranca → deadlock. Se reproduce con `limit` items en vuelo, cada uno con un `enqueue` anidado (test `re-entrant at concurrency limit does not deadlock`).

**Solución.** Detección de re-entrada con `AsyncLocalStorage`:
- `processItem` ejecuta `promiseInFunc()` dentro de `als.run(from, …)`, de modo que cualquier `enqueue` de la cadena async hereda el contexto.
- `enqueue` marca el item con `reentrant: this.als.getStore() === from`.
- El pump: con capacidad arranca FIFO estricto (idx 0); al límite, solo arranca el primer item **re-entrante** (`findIndex(i => i.reentrant)`). Un item re-entrante es una continuación que desbloquea a un padre bloqueado: no consume trabajo independiente real.

**Invariante actualizada (I6):** la concurrencia de items **no re-entrantes** ≤ `concurrencyLimit`; los re-entrantes pueden excederlo para desbloquear a su padre. El test de propiedad `concurrency never exceeds limit` usa trabajo no re-entrante → sigue validando el límite.

**Riesgo residual:** un flujo patológico que encole re-entrantes sin límite podría crecer más allá del límite. En la práctica el crecimiento está acotado por la profundidad/estructura del flujo (cada `sendFlow` awaita un mensaje por vez). El timeout sigue como red.

## 5ter. Fase 3 — `CoreClass.stop()` — **IMPLEMENTADA**

`createBot` devolvía un `CoreClass` sin `stop()` (solo el provider lo tenía) → los e2e/consumidores no podían cerrar el servidor HTTP. Se agrega `CoreClass.stop()` que delega en `provider.stop()` de forma tolerante: ignora providers sin `stop()` y el error `ERR_SERVER_NOT_RUNNING` (servidor no iniciado).

## 5quater. Fase 4 — cancelación cooperativa + `clearAll()` — **IMPLEMENTADA**

**Problema.** Al expirar el timeout, `processItem` rechaza el item pero `promiseInFunc()` sigue corriendo en background: el envío puede completarse y, peor, el callback del flujo puede continuar encolando mensajes *después* de que el item ya fue declarado en timeout (riesgo de reenvío/efectos tardíos).

**Solución.** Señal de cancelación cooperativa:
- `enqueue` recibe `promiseInFunc: (signal: QueueTaskSignal) => Promise<T>`; el signal es un objeto con getter `cancelled` que refleja `item.cancelled`.
- El timer, al expirar, marca `item.cancelled = true` antes de rechazar.
- `coreClass.enqueueMsg` chequea `signal.cancelled` antes del envío y **antes de ejecutar el callback del flujo** (si expiró, no continúa la cadena). `sendFlowSimple` idem.
- Se agrega `Queue.clearAll()` (limpia todos los `from`) y `CoreClass.stop()` ahora la invoca.

**Compatibilidad:** el parámetro `signal` es opcional en la práctica (una función sin parámetros es asignable); los tests existentes no se modifican.

## 5quinquies. Fase 5 — timeout por flujo + teardown con `stop()` — **IMPLEMENTADA**

**Timeout por flujo.** Hoy el timeout era global del bot (`queue.timeout`). Se permite override por mensaje:
- `ActionPropertiesKeyword` gana `timeout?: number` (por tanto `addAnswer('x', { timeout: 5000 })` y las opciones de `addAction` lo aceptan).
- `addAnswer.getAnswerOptions()` lo copia al `options` del mensaje.
- `Queue.enqueue(from, fn, ref, timeout?)` usa `item.timeout ?? this.timeout` para el timer del item.
- `coreClass.enqueueMsg` / `sendFlowSimple` pasan `ctxMessage?.options?.timeout`.

**Teardown con `stop()`.** `__mock__/env.clear()` ahora hace teardown best-effort: si el test expuso `context.bot`, llama a `CoreClass.stop()`; si no, cierra el servidor del provider **solo si está escuchando** (`server.server.listening`), evitando `ERR_SERVER_NOT_RUNNING`. Nunca rompe el teardown (try/catch).

## 6. Fase 2 — bugs secundarios (commits separados, mismo RFC) — **IMPLEMENTADA**

| # | Cambio | Riesgo | Justificación | Estado |
|---|---|---|---|---|
| Q5+Q6 | Key de `timers` → `${from}::${fingerIdRef}` (helper `timerKey`); `clearQueue(from)` solo borra/cancela claves con su prefijo | Mínimo: ningún test inspecciona `timers`; `promiseFunc` ya tiene `from` en closure | Elimina cancelación cruzada de timers entre usuarios | ✅ + test de gate (`clearQueue(from) does not cancel timers of another from`) |
| Q7 | Quitar `clearAndDone` de `cancel()` (el `.finally` ya lo cubre) | Mínimo: `clearIdFromCallback` es idempotente; solo elimina un log duplicado | Higiene | ✅ |

> Fase 2 se mantiene en commits separados de Fase 1 para permitir revert independiente.

---

## 7. Plan de pruebas

### 7.1 Test de regresión nuevo (obligatorio)

`packages/bot/__tests__/units/queue.reentrant.test.ts` (3 casos: deadlock simple, profundidad 3, aislamiento entre `from`):

```ts
test('Queue - re-entrant enqueue same from does not deadlock', async () => {
    const queue = new Queue<string>(mockLogger, 15, 300) // timeout corto: antes del fix esto explota
    const order: string[] = []

    const result = await queue.enqueue('user1', async () => {
        order.push('A-start')
        await new Promise((r) => setTimeout(r, 1)) // fidelidad: en el flujo real el callback
        // corre DESPUÉS de `await sendProviderAndSave(...)`, i.e. con workingOnPromise ya en true
        await queue.enqueue('user1', async () => { order.push('B') }, 'ref-B')
        order.push('A-end')
    }, 'ref-A')

    assert.is(result, 'success')
    assert.equal(order, ['A-start', 'B', 'A-end'])
})
```

> **Fidelidad del test (aprendizaje del gate):** si la re-entrada se hace de forma *síncrona*, el `enqueue` anidado observa `workingOnPromise = false` (porque `processQueue` se invoca antes del `set`) y el deadlock **no** se reproduce. El test debe diferir la re-entrada un tick, como ocurre en el flujo real.

Gate verificado: **falla en `main`** (deadlock → uvu sale temprano) y **pasa con el fix**.

### 7.2 Tests de propiedades nuevos (recomendados)

```ts
test('Queue - concurrency never exceeds limit', ...)        // contador atómico en tasks; assert max ≤ 15 con 50 items
test('Queue - FIFO start order preserved', ...)             // 20 items, assert orden de arranque === orden de enqueue
test('Queue - burst same from resolves all', ...)           // 100 ráfaga, todos resuelven 'success', idsCallbacks vacío
test('Queue - re-entrant depth 3', ...)                     // A→B→C anidados, resuelve sin timeout
test('Queue - from isolation under re-entrancy', ...)       // re-entrada en 'u1' no retrasa items de 'u2'
```

### 7.3 Matriz de regresión (tests existentes que NO se tocan)

| Test | Por qué sigue verde |
|---|---|
| `queue.test.ts` enqueue/process | single item: shift → process → resolve `'success'` |
| `queue.test.ts` clearQueue | item en vuelo ya salió de la cola (igual que con splice); retorna 0 |
| `queue.behavior.test.ts` timeout | timer intacto (I2) |
| `queue.behavior.test.ts` duplicate | dedupe opera sobre `queueByFrom` (I3), sin cambios |
| `queue.behavior.test.ts` clearQueue silencioso | I4 intacto |
| e2e `0.2.4` backpressure 12 usuarios | colas por `from` independientes |
| e2e `0.2.4` ráfaga ×10 mismo `from` | hoy ya corrían concurrentes dentro del batch de 15; con ventana deslizante igual (I6), `idsCallbacks` vacío al final |
| e2e `0.1.4-flow-dynamic`, `0.0.2-goto-flow` | la cadena de envío no cambia; solo desaparece el timeout espurio |

### 7.4 Comandos de validación (en orden, todos deben pasar)

```bash
# 1. Gate de regresión: confirmar que el nuevo test FALLA en main
git stash && pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/units "^queue.reentrant" ; git stash pop

# 2. Unit de la Queue
pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/units "^queue"

# 3. Suite completa del paquete (unit + e2e)
pnpm --filter @builderbot/bot test

# 4. Soak anti-flakiness: 20 corridas del e2e de ráfagas + flow-dynamic
for i in $(seq 1 20); do
  pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/e2e "^0\\.2\\.4|^0\\.1\\.4" || break
done

# 5. Lint / format / build
pnpm run lint:check && pnpm run format:check
pnpm --filter @builderbot/bot build
```

### 7.5 Criterios de aceptación

- [ ] Test de regresión falla en `main`, pasa con el fix (7.4 paso 1–2)
- [ ] 100% suite `@builderbot/bot` verde sin tocar tests existentes
- [ ] 20/20 corridas del soak sin `Queue item timeout`
- [ ] Lint/format/build verdes
- [ ] Diff de producción limitado a `queueClass.ts` (+ Fase 2 si se aprueba)

---

## 8. Rollout & Rollback

**Rollout**
1. PR 1: Fase 1 + tests (7.1, 7.2). Merge → release patch `1.4.5`.
2. PR 2 (opcional): Fase 2. Release patch separado.
3. Verificación post-release: consumidores con flujos `addAnswer(..., { capture: true })` + `flowDynamic` con continuación dejan de ver `Queue item timeout` en logs.

**Rollback**
- `git revert` del PR 1 → comportamiento exactamente anterior. Sin migraciones, sin cambios de API, sin estado persistido, sin flags.

**Observabilidad (mínima, sin cambios de código extra)**
- El fix no agrega logs nuevos. Diagnóstico post-fix: si reapareciera `Queue item timeout`, los logs existentes `QUEUE/EXECUTING/SUCCESS/ERROR` por `from` bastan para reconstruir la secuencia.

---

## 9. Riesgos residuales (honestidad técnica)

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| ~~Re-entrada con profundidad ≥ `concurrencyLimit`~~ | **Resuelto en Fase 3** (detección de re-entrada con ALS) | Test de gate verificado |
| ~~Timeout deja el trabajo corriendo / doble envío~~ | **Mitigado en Fase 4** (cancelación cooperativa: no se ejecuta el callback tras el timeout) | El envío ya iniciado no es abortable a mitad de vuelo (limitación de la API del provider) |
| Crecimiento de in-flight por re-entrada sin límite en flujos patológicos | Muy baja | Acotado por la estructura del flujo; timeout como red |
| ~~Q8 (race de cierre)~~ | **No aplica** | Descartado por atomicidad de JS (ver §2 Q8) |
| Mayor overlap temporal entre "lotes" (un item nuevo arranca apenas se libera un slot, no al cerrar el batch) | Baja: ya ocurría dentro de cada batch de 15; orden de inicio FIFO intacto (I5) | Tests de propiedad 7.2 |
| `Promise.race(inFlight)` sobre `Set` | Nula: `Promise.race` acepta iterables (spec ES2015) | — |

---

## 10. Follow-ups fuera de scope

- **Release**: bump `@builderbot/bot` `1.4.4 → 1.4.5`, build y publish (ver §8).
- Abortar el envío *en vuelo* (requiere soporte del provider; la cancelación actual es cooperativa entre awaits).
