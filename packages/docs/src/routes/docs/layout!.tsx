import { component$, Slot, useStore } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'
import Footer from '~/components/widgets/Footer'
import Header from '~/components/widgets/Header'
import NavBar from '~/components/widgets/NavBar'
// import Navigation from '~/components/widgets/Navigation'
// import Collaborators from '~/components/widgets/Collaborators'
// import ExtraBar from '~/components/widgets/ExtraBar'

export default component$(() => {
    const store = useStore({
        options: [
            {
                title: 'Primeros pasos',
                list: [
                    { name: 'Vista rápida', link: '/docs' },
                    { name: 'Instalación', link: '/docs/install' },
                    { name: 'Ejemplo', link: '/docs/example' },
                ],
            },
            {
                title: 'Conceptos',
                list: [
                    { name: 'Resumen', link: '/docs/concepts' },
                    { name: 'Proveedores', link: '/docs/install' },
                    { name: 'Base de datos', link: '/docss' },
                ],
            },
            {
                title: 'Avanzado',
                list: [
                    { name: 'Migración', link: '/docs/migration' },
                    { name: 'Extender', link: '/docs/migration' },
                ],
            },
            {
                title: 'Comunidad',
                list: [{ name: 'Migración', link: '/docs/migration' }],
            },
        ],
    })

    return (
        <>
            <Header />
            <main class="container mx-auto px-12 ">
                <div class={'grid grid-cols-5 gap-1 min-h-min'}>
                    <div class={'col-span-1'}>
                        <NavBar options={store.options} />
                    </div>
                    <div class={'px-3  col-span-3 slot pb-5'}>
                        <Slot />
                        {/* <Navigation pages={[null,store.options[0][1]]} /> */}
                    </div>
                    <div class={'px-3 col-span-1  '}>
                        <NavBar options={store.options} />
                    </div>
                </div>
            </main>

            <Footer />
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
