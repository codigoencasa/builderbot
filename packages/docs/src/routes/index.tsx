import { component$, Resource } from '@builder.io/qwik'
import { DocumentHead, useEndpoint } from '@builder.io/qwik-city'
import Hero from '~/components/widgets/Hero'
import Features from '~/components/widgets/Features'
import FAQs from '~/components/widgets/FAQs'
import CallToAction from '~/components/widgets/CallToAction'
import Collaborators from '~/components/widgets/Collaborators'
import { fetchGithub } from '~/services/github'
import { RequestHandlerNetlify } from '@builder.io/qwik-city/middleware/netlify-edge'
import { GITHUB_TOKEN } from './docs/constant'

export const onGet: RequestHandlerNetlify = async ({ platform }) => {
    const CHECK_GITHUB_TOKEN =
        (platform as any)?.['GITHUB_TOKEN'] ?? GITHUB_TOKEN
    console.log(`[🚩 platform]: `, GITHUB_TOKEN)
    const data = await fetchGithub(CHECK_GITHUB_TOKEN)
    return data
}

export default component$(() => {
    const resource = useEndpoint()

    return (
        <>
            <Hero />
            <Features />
            <CallToAction />
            <Resource
                value={resource}
                onResolved={(data: any) => <Collaborators users={data} />}
            ></Resource>
            <FAQs />
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
