import { component$ } from '@builder.io/qwik'

export const ButtonLink = component$((props: { name: string; link: string; direction: 'left' | 'right' }) => {
    const ArrowRight = () => (
        <svg
            viewBox="0 0 3 6"
            class="ml-3 w-auto h-1.5 text-slate-400 overflow-visible group-hover:text-slate-600 dark:group-hover:text-slate-300"
        >
            <path
                d="M0 0L3 3L0 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>
    )

    const ArrowLeft = () => (
        <svg
            viewBox="0 0 3 6"
            class="mr-3 w-auto h-1.5 text-slate-400 overflow-visible group-hover:text-slate-600 dark:group-hover:text-slate-300"
        >
            <path
                d="M3 0L0 3L3 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>
    )

    return (
        <a class="group flex items-center hover:text-slate-900 dark:hover:text-white" href={props.link}>
            {props.direction === 'left' ? (
                <>
                    <ArrowLeft />
                    {props.name}
                </>
            ) : (
                <>
                    {props.name}
                    <ArrowRight />
                </>
            )}
        </a>
    )
})

export default component$((props: { pages: ({ name: string; link: string } | null)[] }) => {
    const { pages } = props
    return (
        <div class="text-sm leading-6 mt-12">
            <div class="mb-10 text-slate-700 font-semibold flex justify-between items-center dark:text-slate-200">
                {pages[0] ? <ButtonLink direction="left" {...pages[0]} /> : null}
                {pages[1] ? <ButtonLink direction="right" {...pages[1]} /> : null}
            </div>
        </div>
    )
})
