import { component$, Slot } from '@builder.io/qwik'

export default component$(() => {
    return (
        <div
            class="p-4 border border-slate-200 rounded my-2 bg-gray-50  dark:border-gray-600 dark:bg-gray-700"
            role="alert"
        >
            <div class=" mb-2 text-md ">
                <Slot />
            </div>
        </div>
    )
})
