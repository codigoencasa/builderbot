import { component$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

export default component$(() => {
    return (
        <>
            <section>
                <div class="max-w-6xl mx-auto py-6 px-4 sm:px-6 h-[60vh]">
                    <h1 class="text-4xl font-bold leading-tighter tracking-tighter mb-8 font-heading">
                        Blog
                    </h1>
                    <p class="text-xl">Coming soon ...</p>
                </div>
            </section>
        </>
    )
})

export const head: DocumentHead = {
    title: 'Blog — Qwind',
    meta: [
        {
            name: 'description',
            content: 'Lorem ipsum lorem ...',
        },
    ],
}
