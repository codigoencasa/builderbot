# Meta Provider — Mensajes Interactivos sin Plantillas

Este documento describe los métodos del `MetaProvider` para enviar **botones** y **listas** de forma interactiva usando la WhatsApp Cloud API, **sin necesidad de plantillas aprobadas en Meta Business**.

> **Requisito importante:** Los mensajes interactivos solo pueden enviarse dentro de la **ventana de conversación activa de 24 horas**. Si el usuario no ha escrito en las últimas 24h, es obligatorio usar un template aprobado para reabrir la ventana.

---

## Diferencia: Interactivo vs Template

| Tipo | Requiere aprobación | Válido fuera de 24h |
|---|---|---|
| `interactive/button` | No | No |
| `interactive/list` | No | No |
| `interactive/cta_url` | No | No |
| `template` | Sí (Meta Business) | Sí |

---

## Botones

### `sendButtons` — Reply buttons (máx. 3)

Envía hasta 3 botones de respuesta rápida. Cada título tiene un límite de **20 caracteres** (internamente se trunca a 16).

```typescript
await provider.sendButtons(
    '5491112345678',
    [
        { body: 'Sí, confirmo' },
        { body: 'No, cancelar' },
        { body: 'Ver más info' },
    ],
    '¿Deseas confirmar tu pedido?'
)
```

**Payload enviado a la API:**

```json
{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5491112345678",
    "type": "interactive",
    "interactive": {
        "type": "button",
        "body": { "text": "¿Deseas confirmar tu pedido?" },
        "action": {
            "buttons": [
                { "type": "reply", "reply": { "id": "btn-0", "title": "Sí, confirmo" } },
                { "type": "reply", "reply": { "id": "btn-1", "title": "No, cancelar" } },
                { "type": "reply", "reply": { "id": "btn-2", "title": "Ver más info" } }
            ]
        }
    }
}
```

---

### `sendButtonUrl` — Botón con URL externa (CTA)

Envía un único botón que abre una URL en el navegador del usuario.

```typescript
await provider.sendButtonUrl(
    '5491112345678',
    { body: 'Ir al sitio', url: 'https://example.com/pedido/123' },
    'Tu pedido está listo. Haz clic para ver el detalle:'
)
```

**Payload enviado a la API:**

```json
{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5491112345678",
    "type": "interactive",
    "interactive": {
        "type": "cta_url",
        "body": { "text": "Tu pedido está listo. Haz clic para ver el detalle:" },
        "action": {
            "name": "cta_url",
            "parameters": {
                "display_text": "Ir al sitio",
                "url": "https://example.com/pedido/123"
            }
        }
    }
}
```

---

### `sendButtonsMedia` — Botones con imagen o video como header

Envía botones de respuesta rápida con una imagen o video como encabezado visual.

```typescript
// Con imagen
await provider.sendButtonsMedia(
    '5491112345678',
    'image',
    [{ body: 'Comprar' }, { body: 'Ver más' }],
    'Producto destacado de la semana',
    'https://example.com/producto.jpg'
)

// Con video
await provider.sendButtonsMedia(
    '5491112345678',
    'video',
    [{ body: 'Me interesa' }],
    'Mira nuestro nuevo producto',
    'https://example.com/demo.mp4'
)
```

**Payload enviado a la API (ejemplo imagen):**

```json
{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5491112345678",
    "type": "interactive",
    "interactive": {
        "type": "button",
        "header": {
            "type": "image",
            "image": { "link": "https://example.com/producto.jpg" }
        },
        "body": { "text": "Producto destacado de la semana" },
        "action": {
            "buttons": [
                { "type": "reply", "reply": { "id": "btn-0", "title": "Comprar" } },
                { "type": "reply", "reply": { "id": "btn-1", "title": "Ver más" } }
            ]
        }
    }
}
```

---

## Listas

### `sendListComplete` — Lista con parámetros explícitos (recomendado)

Envía una lista interactiva con header, body, footer y secciones con filas. Ideal cuando se construye la lista desde código.

```typescript
await provider.sendListComplete(
    '5491112345678',
    'Menú principal',           // header
    'Elige una opción:',        // body
    'Horario: Lun-Vie 9-18h',  // footer
    'Ver opciones',             // texto del botón para abrir la lista
    [
        {
            title: 'Soporte',
            rows: [
                { id: 'soporte-tecnico', title: 'Soporte técnico', description: 'Problemas con el sistema' },
                { id: 'soporte-factura', title: 'Facturación', description: 'Consultas sobre pagos' },
            ],
        },
        {
            title: 'Ventas',
            rows: [
                { id: 'ventas-nuevo', title: 'Nuevo cliente', description: 'Quiero conocer los planes' },
                { id: 'ventas-upgrade', title: 'Actualizar plan', description: 'Mejorar mi suscripción' },
            ],
        },
    ]
)
```

**Payload enviado a la API:**

```json
{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "5491112345678",
    "type": "interactive",
    "interactive": {
        "type": "list",
        "header": { "type": "text", "text": "Menú principal" },
        "body": { "text": "Elige una opción:" },
        "footer": { "text": "Horario: Lun-Vie 9-18h" },
        "action": {
            "button": "Ver opciones",
            "sections": [
                {
                    "title": "Soporte",
                    "rows": [
                        { "id": "soporte-tecnico", "title": "Soporte técnico", "description": "Problemas con el sistema" },
                        { "id": "soporte-factura", "title": "Facturación", "description": "Consultas sobre pagos" }
                    ]
                },
                {
                    "title": "Ventas",
                    "rows": [
                        { "id": "ventas-nuevo", "title": "Nuevo cliente", "description": "Quiero conocer los planes" },
                        { "id": "ventas-upgrade", "title": "Actualizar plan", "description": "Mejorar mi suscripción" }
                    ]
                }
            ]
        }
    }
}
```

---

### `sendList` — Lista con objeto `MetaList` raw

Versión de bajo nivel que acepta directamente el objeto de la Cloud API. Útil cuando se construye el payload manualmente o se tiene mayor control.

```typescript
await provider.sendList('5491112345678', {
    header: { type: 'text', text: 'Opciones disponibles' },
    body: { text: 'Selecciona lo que necesitas' },
    footer: { text: 'Bot de atención' },
    action: {
        button: 'Abrir menú',
        sections: [
            {
                title: 'Categoría A',
                rows: [
                    { id: 'a1', title: 'Opción A1', description: 'Descripción opcional' },
                ],
            },
        ],
    },
})
```

---

## Limitaciones de la Cloud API

| Restricción | Valor |
|---|---|
| Máx. botones por mensaje (`sendButtons`) | 3 |
| Máx. caracteres por título de botón | 20 (se trunca a 16 internamente) |
| Máx. secciones por lista | 10 |
| Máx. filas por sección | 10 |
| Máx. filas totales por lista | 10 |
| Máx. caracteres en título de fila | 24 |
| Máx. caracteres en descripción de fila | 72 |
| Máx. caracteres en texto del botón de lista | 20 |
| Ventana de uso sin template | 24 horas desde último mensaje del usuario |

---

## Cómo capturar la respuesta del usuario

Cuando el usuario selecciona un botón o fila de lista, el mensaje entrante llega con la siguiente estructura en `ctx`:

```typescript
// Botón de reply
ctx.body           // Texto del botón (ej: "Sí, confirmo")
ctx.type           // "interactive"

// Fila de lista
ctx.body           // id de la fila seleccionada (ej: "soporte-tecnico")
ctx.type           // "interactive"
```

Ejemplo en un flujo:

```typescript
const flow = addKeyword(['menu'])
    .addAction(async (ctx, { provider }) => {
        await provider.sendListComplete(
            ctx.from,
            'Menú',
            '¿En qué te ayudamos?',
            'Atención 24/7',
            'Ver opciones',
            [
                {
                    title: 'Soporte',
                    rows: [{ id: 'tecnico', title: 'Soporte técnico', description: '' }],
                },
            ]
        )
    })
    .addAnswer('', null, async (ctx, { gotoFlow }) => {
        if (ctx.body === 'tecnico') return gotoFlow(flujoSoporteTecnico)
    })
```
