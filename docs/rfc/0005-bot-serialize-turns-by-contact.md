# RFC 0005 — `@builderbot/bot`: un turno a la vez por contacto (`queue.serializeByContact`)

| Field | Value |
|---|---|
| Status | **Implementado** en la rama `fix-serialize-turns-by-contact` (pendiente de review/merge) |
| Author | Engineering (agent-assisted) |
| Issue | Un contacto que escribe mientras el bot todavía procesa su mensaje anterior recibe respuestas repetidas, pierde respuestas o dispara varias veces los pasos siguientes del flujo |
| Provenance | Reproducido ejecutando el motor real con un flujo sintético; mecanismo leído en `packages/bot/src/core/coreClass.ts` y `src/utils/queueClass.ts` |
| Reviewers | Maintainer (`@leifermendez`) |
| Target version | La decide el maintainer al publicar. Cambio aditivo y opt-in: sin cambios de API existentes |
| Risk | Bajo con la opción apagada (valor por defecto): el camino de cada mensaje solo añade la lectura de un booleano. Revertible con `git revert` |
| Baseline | `@builderbot/bot@1.4.4`, suite UVU del paquete verde (208 tests sobre `builderbot-dev`) |

---

## 1. Resumen

**Problema.** El core ejecuta `handleMsg` una vez por mensaje entrante y **no ordena los mensajes de un mismo contacto**. Si llega un mensaje mientras el anterior sigue en curso (una respuesta de IA tarda segundos), los dos turnos corren a la vez sobre el mismo estado, el mismo historial y la misma cola, y se pisan.

**Propuesta.** Opción nueva `queue.serializeByContact` (por defecto `false`). Con `true`, los mensajes de un mismo `from` se procesan en orden de llegada, uno a la vez. Los contactos distintos siguen en paralelo.

**Impacto.** Con la opción apagada nada cambia. Con la opción encendida, cada mensaje entregado produce exactamente un turno, en orden.

```ts
const bot = await createBot(
    { flow, provider, database },
    { queue: { timeout: 50000, concurrencyLimit: 15, serializeByContact: true } }
)
```

---

## 2. Motivación — evidencia

### 2.1 Qué comparten dos turnos del mismo contacto

| ID | Hallazgo | Dónde |
|---|---|---|
| T1 | El listener de `message` llama a `handleMsg` sin ningún orden por contacto | `coreClass.ts`, `listenerBusEvents` |
| T2 | `clearQueue(from)` cancela **todo** lo pendiente del contacto, no solo lo del turno que lo llama. Lo invocan `endFlow`, `endFlowToGotoFlow` (todo `gotoFlow`) y `fallBack` | `coreClass.ts`, `queueClass.ts` (`clearQueue`) |
| T3 | `continueFlow` retoma el flujo desde `database.getPrevByNumber(from)`: el último paso guardado **por cualquier turno** del contacto | `coreClass.ts`, `continueFlow` |
| T4 | `Queue.enqueue` descarta en silencio un item cuyo `fingerIdRef` ya está pendiente para ese `from` (dos turnos en el mismo paso comparten `ref`) | `queueClass.ts`, `enqueue` |
| T5 | El estado (`state.get` / `state.update`) es uno por contacto | `coreClass.ts`, `stateHandler` |

### 2.2 Reproducción (motor real, flujo sintético)

Flujo de bienvenida con cuatro pasos sin `capture`: una acción lenta que responde con `flowDynamic` (simula una IA de 1,5 s) seguida de tres acciones (A, B, C). Cada mensaje se entrega dos veces con 100 ms de diferencia. Los pasos cuentan sus llamadas.

| Escenario | Respuestas | Veces que corre cada paso siguiente |
|---|---|---|
| Control: dos mensajes, cada uno con el bot en reposo, con agrupado de mensajes (debounce) en la aplicación | 2 | 2 / 2 / 2 |
| Segundo mensaje **durante** la respuesta al primero, con debounce | 1 o 2 (el segundo quedó sin respuesta en 2 de 3 ejecuciones) | hasta 7 / 13 / 12 |
| Lo mismo, sin debounce (6 entregas) | 6 | 34 / 45 / 62 |
| Lo mismo, sin debounce, **con `serializeByContact: true`** (6 entregas) | 6 | 6 / 6 / 6 (dos ejecuciones idénticas) |
| Con debounce y **con `serializeByContact: true`** | 2 | 2 / 2 / 2 (tres ejecuciones seguidas) |

La reproducción vive en la aplicación que consume el core (usa su propio constructor de flujos), no en este repo. Lo que este repo fija con tests está en §6.

---

## 3. Objetivos / fuera de alcance

**Objetivos**
- G1. Con la opción encendida, nunca hay dos turnos del mismo `from` a la vez.
- G2. Orden de llegada (FIFO) por contacto; contactos distintos en paralelo.
- G3. Un turno que no termina no bloquea al contacto para siempre.
- G4. Con la opción apagada, comportamiento idéntico al actual y **sin modificar un solo test existente**.

**Fuera de alcance**
- No se cambia el valor por defecto: activarla es decisión de quien crea el bot (ver §7).
- No deduplica entregas repetidas de un mismo mensaje: cada entrega es un turno (fila 4 de §2.2). Eso corresponde al proveedor o a la aplicación.
- No se toca `Queue`, `clearQueue`, `continueFlow` ni la cadena de envío. T2–T4 siguen ahí; la opción impide que dos turnos coincidan, que es cuando hacen daño.
- No coordina varios procesos: el orden se guarda en memoria del proceso que recibe el mensaje.

---

## 4. Diseño

### 4.1 Cambios

| Archivo | Cambio |
|---|---|
| `packages/bot/src/types.ts` | `GeneralArgs.queue.serializeByContact?: boolean` |
| `packages/bot/src/core/coreClass.ts` | El listener de `message` pasa por `runContactTurn` solo si la opción está encendida. `runContactTurn` + `contactTurns` (privados) |

### 4.2 `runContactTurn`

```ts
private runContactTurn = <T>(from: string, turn: () => Promise<T>): Promise<T> => {
    const previous = this.contactTurns.get(from)
    let release!: () => void
    const released = new Promise<void>((resolve) => {
        release = resolve
    })
    this.contactTurns.set(from, released)

    const free = () => {
        release()
        if (this.contactTurns.get(from) === released) this.contactTurns.delete(from)
    }

    const start = async (): Promise<T> => {
        const guard = setTimeout(free, this.generalArgs.queue?.timeout ?? QUEUE_TIMEOUT_FALLBACK)
        guard.unref?.()
        try {
            return await turn()
        } finally {
            clearTimeout(guard)
            free()
        }
    }

    return previous ? previous.then(start) : start()
}
```

`contactTurns` guarda, por contacto, la promesa que se resuelve cuando su último turno suelta el contacto. Cada turno nuevo se encadena detrás de esa promesa y la sustituye por la suya.

### 4.3 Contrato

| ID | Invariante | Cómo se cumple |
|---|---|---|
| I1 | Opción apagada ⇒ el camino es `handleMsg(incoming)` directo, como antes | `if (!this.generalArgs.queue?.serializeByContact) return this.handleMsg(incoming)` |
| I2 | Un turno a la vez por `from`, en orden de llegada | cada turno espera a `previous` |
| I3 | Sin turno en curso, el turno arranca en el mismo tick que con la opción apagada | `previous ? previous.then(start) : start()` |
| I4 | El contacto se suelta al terminar el turno o `queue.timeout` después de que **arrancó**, lo que ocurra antes | `guard` se crea dentro de `start`, no al encolar |
| I5 | Un turno que falla suelta el contacto y su error aflora igual que con la opción apagada | `try/finally`; nadie captura el rechazo aquí |
| I6 | No queda rastro: el mapa se vacía cuando termina el último turno del contacto | `free` borra la entrada si sigue siendo la suya |
| I7 | Las subclases que redefinen `handleMsg` (`contexts-dialogflow`, `contexts-dialogflow-cx`) siguen usando la suya | el turno llama a `this.handleMsg` |

**Complejidad.** O(1) por mensaje (una lectura y una escritura de `Map`, una promesa y un temporizador por turno). Memoria: una entrada por contacto con un turno en curso.

### 4.4 Por qué no las alternativas

| Alternativa | Por qué no |
|---|---|
| `concurrencyLimit: 1` | Medido: ordena los pasos si el flujo responde con `flowDynamic`, pero si el turno en curso hace `gotoFlow`, el mensaje que esperaba **se pierde en silencio** (T2: llega solo la primera respuesta, dos ejecuciones idénticas). Con `serializeByContact` llegan las dos. Además limita la cola de todo el contacto, no solo el arranque de turnos |
| Que `clearQueue` borre solo lo del turno que lo llama, y que `continueFlow` use la posición de su turno | Arregla T2 y T3 pero deja T4 y T5, y cambia semántica que hoy usan todos los bots. Puede hacerse después; no es requisito de esta opción |
| Activarla por defecto | Cambia la latencia percibida de los bots existentes en ráfagas (§5). Se deja como decisión explícita |
| Resolverlo en cada aplicación | Cada una tendría que envolver al proveedor; el core es el único que sabe cuándo termina `handleMsg` |

---

## 5. Rendimiento (medido)

Bot con un flujo de bienvenida de una respuesta, 5 000 mensajes por ejecución, tres ejecuciones por caso, en la máquina de desarrollo.

| Caso | Apagada | Encendida |
|---|---|---|
| 5 000 contactos × 1 mensaje (`MemoryDB`) | 436–604 ms | 466–501 ms |
| 500 contactos × 10 mensajes en ráfaga (base con historial indexado) | 247–328 ms | 304–379 ms |
| 50 contactos × 100 mensajes en ráfaga (base con historial indexado) | 236–250 ms | 333–340 ms |
| 500 contactos × 10 mensajes en ráfaga (`MemoryDB`) | 410–437 ms | 1 166–1 277 ms |

- Un mensaje por contacto: sin diferencia medible.
- En ráfagas, la diferencia es la espera de procesar en orden: un turno aislado tarda cerca de 1 ms y diez seguidos cerca de 10 ms.
- La última fila no es coste de la opción: `MemoryDB.getPrevByNumber` recorre todo el historial en cada llamada, y con turnos en orden los últimos se ejecutan con el historial ya crecido. `MemoryDB` es la base de pruebas; no se modifica aquí.
- En todas las ejecuciones `contactTurns` quedó vacío al terminar.

**Efecto visible para el usuario del bot:** si escribe mientras el bot responde, su mensaje espera a que termine ese turno. El tope de espera por turno es `queue.timeout`.

---

## 6. Pruebas

`packages/bot/__tests__/e2e/0.2.5-serialize-by-contact.test.ts` (8 casos):

| Caso | Qué fija | Falla si… |
|---|---|---|
| Por defecto los turnos corren a la vez y el bloqueo no se usa | I1 | la opción deja de ser opt-in |
| El segundo mensaje espera a que acabe el anterior | I2 | se quita el cambio (visto fallar contra el core sin el cambio) |
| Con un solo slot (`concurrencyLimit: 1`), el `gotoFlow` de un turno no cancela el mensaje que espera | T2 | se quita el cambio (visto fallar contra el core sin el cambio: llega solo la primera respuesta) |
| Contactos distintos siguen en paralelo | G2 | el orden pasa a ser global |
| Un turno colgado libera al contacto tras `queue.timeout` | G3 | se quita el temporizador |
| El límite cuenta desde que arranca cada turno | I4 | el temporizador se crea al encolar (visto fallar con la primera versión y, con el test actual, al mutar el core para crearlo al encolar) |
| El primer turno arranca en el mismo tick y no deja rastro | I3, I6 | se añade un salto asíncrono o se filtra la entrada (visto fallar con la primera versión) |
| Un turno que falla libera al contacto y el error no se traga | I5 | se captura el rechazo (visto fallar con la primera versión) |

Comandos:

```bash
pnpm --filter @builderbot/bot exec uvu -r tsm ./__tests__/e2e "^0\.2\.5-serialize-by-contact\.test\.ts$"
pnpm --filter @builderbot/bot test
pnpm --filter @builderbot/manager test
pnpm --filter @builderbot/contexts-dialogflow test
pnpm --filter @builderbot/contexts-dialogflow-cx test
pnpm --filter @builderbot/bot build
```

Los casos esperan por condición (`waitUntil`), no un tiempo fijo, y los que exigen solapamiento mantienen el turno abierto hasta que el otro arranca: el resultado no depende de la carga de la máquina. Una primera versión con esperas fijas falló 1 de 16 ejecuciones con 4 procesos en paralelo.

Resultado en la rama: caso nuevo 8 de 8 (52 ejecuciones bajo carga sin fallos: 20 con 4 procesos en paralelo y 32 con 8); suite de `@builderbot/bot` 216 de 216 (los 208 anteriores, sin tocar ninguno, más los 8 nuevos); `pnpm test` del monorepo correcto en los 29 proyectos; `manager` 263 de 263; `contexts-dialogflow` 7 de 7; `contexts-dialogflow-cx` 10 de 10; ESLint, Prettier y build de `bot`, `contexts-dialogflow` y `contexts-dialogflow-cx` correctos.

Las suites Jest de los proveedores van incluidas en ese `pnpm test`. No crean un `CoreClass` ni usan `GeneralArgs.queue`; el cambio de tipos es un campo opcional.

---

## 7. Cuándo activarla

Actívala si un turno puede tardar más que el tiempo entre dos mensajes del mismo contacto: respuestas de IA, llamadas HTTP o esperas largas dentro del flujo.

Antes de activarla:

- `queue.timeout` debe ser mayor que el turno más largo esperado. Si un turno lo supera, el contacto se suelta y el siguiente mensaje arranca en paralelo (el comportamiento de hoy).
- Si el proveedor puede entregar dos veces el mismo mensaje, deduplica por id de mensaje antes de emitir `message`: con la opción, cada entrega se contesta, en orden.

---

## 8. Riesgos residuales

| Riesgo | Estado |
|---|---|
| Turno más largo que `queue.timeout` | El contacto se suelta y vuelve la concurrencia para ese mensaje. Documentado en §7 |
| Trabajo que la aplicación lanza **fuera** del turno (por ejemplo un temporizador propio que llama a `gotoFlow` de un turno ya terminado) | No pasa por `runContactTurn`. Leído en el código, sin reproducir: su `clearQueue(from)` podría coincidir con un turno en curso |
| Varios procesos atendiendo al mismo contacto | Fuera de alcance: el orden es por proceso |
| Mensajes en espera al llamar a `stop()` | Siguen su curso cuando termina el turno anterior, igual que los `handleMsg` en vuelo con la opción apagada |

## 9. Rollback

Apagar la opción (o quitarla de `createBot`) devuelve el comportamiento anterior sin publicar nada. Para retirar el código: `git revert` del commit; ningún otro archivo depende de `runContactTurn`.
