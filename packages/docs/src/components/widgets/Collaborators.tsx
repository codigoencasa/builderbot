import { component$ } from '@builder.io/qwik'

export default component$(() => {
    return (
        <div class={'pt-4'}>
            <div class="flex items-center space-x-2 text-base">
                <h4 class="font-semibold text-slate-900">Contributors</h4>
                <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    204
                </span>
            </div>
            <div class="mt-3 flex -space-x-2 overflow-hidden">
                <img
                    class="inline-block h-12 w-12 rounded-full ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt=""
                />
                <img
                    class="inline-block h-12 w-12 rounded-full ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt=""
                />
                <img
                    class="inline-block h-12 w-12 rounded-full ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80"
                    alt=""
                />
                <img
                    class="inline-block h-12 w-12 rounded-full ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt=""
                />
                <img
                    class="inline-block h-12 w-12 rounded-full ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt=""
                />
            </div>
            <div class="mt-3 text-sm font-medium">
                <a href="#" class="text-blue-500">
                    + 198 others
                </a>
            </div>
        </div>
    )
})
