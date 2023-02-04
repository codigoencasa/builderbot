import { component$, useStylesScoped$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'
import { QR } from '~/components/qr/qr'

import style from './index.css?inline'

export default component$(() => {
    useStylesScoped$(style)

    return (
        <div class={'page'}>
            <div class={'qr-section'}>
                <QR />
            </div>
            <div class={'qr-section intructions'}>
                <h1>Whatsapp QR</h1>
                <p>
                    Con esta libreria, puedes configurar respuestas automatizadas para preguntas frecuentes, recibir y
                    responder mensajes de manera automatizada, y hacer un seguimiento de las interacciones con los
                    clientes. <br /> Además, nuestro Chatbot se integra fácilmente con otros sistemas y herramientas que
                    ya esté utilizando en su negocio.
                </p>
                <div class={'qr-section links'}>
                    <a class={'btn-link '} target="_blank" href="https://bot-whatsapp.netlify.app/">
                        Ver documentación
                    </a>
                    <a
                        class={'btn-link '}
                        target="_blank"
                        href="https://www.youtube.com/watch?v=1u0TTbjK5bo&list=PL_WGMLcL4jzViIlmyDZPnhAdkc8RXGkFh"
                    >
                        Ver videos
                    </a>
                    <a class={'btn-link '} target="_blank" href="https://opencollective.com/bot-whatsapp">
                        Comprar café
                    </a>
                </div>
            </div>
        </div>
    )
})

export const head: DocumentHead = {
    title: '🤖 Crear chatbot WhatsApp en minutos',
    meta: [
        {
            name: 'description',
            content: '🤖 Crear chatbot WhatsApp en minutos',
        },
    ],
}
