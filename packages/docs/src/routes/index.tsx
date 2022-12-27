import { component$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

import Hero from '~/components/widgets/Hero'
import Features from '~/components/widgets/Features'
import FAQs from '~/components/widgets/FAQs'
// import Stats from '~/components/widgets/Stats'
import CallToAction from '~/components/widgets/CallToAction'
import Collaborators from '~/components/widgets/Collaborators'

export default component$(() => {
    return (
        <>
            <Hero />
            <Features />
            <CallToAction />
            <Collaborators />
            <FAQs />
            {/* <Stats /> */}
        </>
    )
})

export const head: DocumentHead = {
    title: 'Crear chatbot WhatsApp en minutos — Servicio de chatbot para whatspp gratis proyecto OpenSource',
    meta: [
        {
            name: 'description',
            content:
                'Crear chatbot WhatsApp en minutos — Servicio de chatbot para whatspp gratis proyecto OpenSource',
        },
    ],
}
