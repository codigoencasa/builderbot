import { component$, useContext } from "@builder.io/qwik";
import { DocumentHead } from "@builder.io/qwik-city";
import { RequestHandlerNetlify } from "@builder.io/qwik-city/middleware/netlify-edge";
import Experts from "~/components/widgets/Experts";
import HeroExperts from "~/components/widgets/HeroExperts";
import { ExpertStore } from "~/contexts";
import { fetchGithub } from "~/services/github";
import { fetchOpenCollective } from "~/services/opencollective";
import { GITHUB_TOKEN } from "../docs/constant";

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
    const store = useContext(ExpertStore)
    return (
        <>
            <HeroExperts />
            <Experts users={store} />
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
