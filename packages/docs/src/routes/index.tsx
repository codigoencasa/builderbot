import { component$, Resource } from '@builder.io/qwik'
import {
    DocumentHead,
    RequestHandler,
    useEndpoint,
} from '@builder.io/qwik-city'

import Hero from '~/components/widgets/Hero'
import Features from '~/components/widgets/Features'
import FAQs from '~/components/widgets/FAQs'
// import Stats from '~/components/widgets/Stats'
import CallToAction from '~/components/widgets/CallToAction'
import Collaborators from '~/components/widgets/Collaborators'
import { GITHUB_TOKEN } from './docs/constant'
import { RequestHandlerCloudflarePages } from '@builder.io/qwik-city/middleware/cloudflare-pages'

export const apiGetCollaborators = async (token: string) => {
    const data = await fetch(
        `https://api.github.com/repos/codigoencasa/bot-whatsapp/contributors`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                Authorization: `Bearer ${token}`,
            },
        }
    )
    const listUsers = data.json()
    return listUsers
}

export const onRequest: RequestHandlerCloudflarePages = async ({
    platform,
}) => {
    console.log(`[🚩 platform]: `, platform)
    console.log(`[🚩 platform .env]: `, platform.env)
    const CHECK_GITHUB_TOKEN = platform.env['GITHUB_TOKEN'] ?? GITHUB_TOKEN
    return apiGetCollaborators(CHECK_GITHUB_TOKEN)
}

export default component$(() => {
    const dataUser = useEndpoint()
    return (
        <>
            <Hero />
            <Features />
            <CallToAction />
            <Resource
                value={dataUser}
                onResolved={(users) => <Collaborators users={users} />}
            ></Resource>
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
