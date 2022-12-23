import { component$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

import Hero from '~/components/widgets/Hero'
import Features from '~/components/widgets/Features'
import FAQs from '~/components/widgets/FAQs'
import Stats from '~/components/widgets/Stats'
// import CallToAction from '~/components/widgets/CallToAction'

export default component$(() => {
    return (
        <>
            <Hero />
            <Features />
            {/* <CallToAction /> */}
            <FAQs />
            <Stats />
        </>
    )
})

export const head: DocumentHead = {
    title: 'Chatbot Whatsapp — Servicio de chatbot para whatspp gratis proyecto OpenSource',
    meta: [
        {
            name: 'description',
            content:
                'Qwind is a free and ready to start template to make your website using Qwik and Tailwind CSS.',
        },
    ],
}
