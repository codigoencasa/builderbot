import { component$, Slot, useContext } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'
import ExtraBar from '~/components/widgets/ExtraBar'
import Header from '~/components/widgets/Header'
import NavBar from '~/components/widgets/NavBar'
// import { SearchModal } from '~/components/widgets/SearchModal'
import SponsorBar from '~/components/widgets/SponsorBar'
import { GlobalStore } from '~/contexts'
// import Navigation from '~/components/widgets/Navigation'
// import Collaborators from '~/components/widgets/Collaborators'
// import ExtraBar from '~/components/widgets/ExtraBar'

export default component$(() => {
    const store = useContext(GlobalStore)

    return (
        <>
            {/* <SearchModal /> */}
            <Header />
            <main class={'overflow-hidden'}>
                <div class={'max-w-8xl'}>
                    <div
                        class={
                            'hidden lg:block fixed z-20 inset-0 top-[4rem] left-[max(0px,calc(50%-48rem))] right-auto w-[14.5rem] py-5 px-8 overflow-y-auto'
                        }
                    >
                        <NavBar options={store} />
                    </div>
                    <div class={'lg:pl-[14.5rem] lg:pr-[14.5rem]'}>
                        <div class={'slot max-w-3xl mx-auto relative z-20 p-5 xl:max-w-none'}>
                            <Slot />
                        </div>
                    </div>
                    <div
                        class={
                            'hidden lg:block fixed z-20 inset-0 top-[4rem] right-[max(0px,calc(50%-48rem))] left-auto w-[14.5rem] py-5 px-8 overflow-y-auto'
                        }
                    >
                        <ExtraBar />
                        <SponsorBar />
                    </div>
                </div>
            </main>
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
