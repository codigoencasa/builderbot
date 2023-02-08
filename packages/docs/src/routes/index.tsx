import { component$, Resource } from '@builder.io/qwik'
import { DocumentHead, useEndpoint } from '@builder.io/qwik-city'
import Hero from '~/components/widgets/Hero'
import Features from '~/components/widgets/Features'
import FAQs from '~/components/widgets/FAQs'
import CallToAction from '~/components/widgets/CallToAction'
import Collaborators from '~/components/widgets/Collaborators'
import Members from '~/components/widgets/Members'
import { fetchGithub } from '~/services/github'
import { fetchOpenCollective } from '~/services/opencollective'
import { RequestHandlerNetlify } from '@builder.io/qwik-city/middleware/netlify-edge'
import { GITHUB_TOKEN } from './docs/constant'
// import { SearchModal } from '~/components/widgets/SearchModal'

export const onGet: RequestHandlerNetlify = async ({ platform }) => {
    const CHECK_GITHUB_TOKEN = (platform as any)?.['GITHUB_TOKEN'] ?? GITHUB_TOKEN
    const dataGithub = await fetchGithub(CHECK_GITHUB_TOKEN)
    const dataOpenCollective = await fetchOpenCollective()
    return {
        dataGithub,
        dataOpenCollective,
    }
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
                onResolved={(data: any) => {
                    return (
                        <>
                            <Collaborators users={data.dataGithub} />
                            <FAQs />
                            <Members users={data.dataOpenCollective} />
                        </>
                    )
                }}
            ></Resource>
        </>
    )
})

export const head: DocumentHead = {
    title: 'Crear chatbot WhatsApp en minutos — Servicio de chatbot para whatspp gratis proyecto OpenSource',
    meta: [
        {
            name: 'description',
            content: 'Crear chatbot WhatsApp en minutos — Servicio de chatbot para whatspp gratis proyecto OpenSource',
        },
    ],
}
