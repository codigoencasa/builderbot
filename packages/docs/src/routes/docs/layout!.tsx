import { component$, Slot, useStore } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'
import Footer from '~/components/widgets/Footer'
import Header from '~/components/widgets/Header'
import NavBar from '~/components/widgets/NavBar'

export default component$(() => {
    const store = useStore({
        options: [
            { name: 'Primeros pasos', link: '/docs', class: 'font-semibold' },
            { name: 'Instalación', link: '/docs' },
            { name: 'Configuración', link: '/docs' },
            { name: 'Forma de pensar', link: '/docs' },
        ],
    })

    return (
        <>
            <Header />
            <main class="container mx-auto px-12">
                <div class={'grid grid-cols-4 gap-4'}>
                    <div class={' col-span-1'}>
                        <NavBar options={store.options} />
                    </div>
                    <div class={'col-span-3'}>
                        <Slot />
                    </div>
                </div>
            </main>

            <Footer />
        </>
    )
})

export const head: DocumentHead = {
    title: 'Qwind — Free template for starts a website using Qwik + Tailwind CSS',
    meta: [
        {
            name: 'description',
            content:
                'Qwind is a free and ready to start template to make your website using Qwik and Tailwind CSS.',
        },
    ],
}
