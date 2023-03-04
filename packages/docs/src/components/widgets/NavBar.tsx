import { component$ } from '@builder.io/qwik'
import { Link, useLocation } from '@builder.io/qwik-city'
import { DocumentationCtx } from '~/contexts'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(({ options = [] }: { options: DocumentationCtx[] }) => {
    return (
        <div>
            {options.map((item, i) => (
                <UlCompoent key={i} title={item.title} list={item.list} />
            ))}
        </div>
    )
})

export const UlCompoent = component$((porps: { title: string; list: { link: string; name: string }[] }) => {
    return (
        <ul>
            <li class="mt-2 lg:mt-2">
                <h5 class="mb-8 lg:mb-3 font-semibold text-slate-900 dark:text-slate-200">{porps.title}</h5>
                <LiComponent list={porps.list} />
            </li>
        </ul>
    )
})

export const LiComponent = component$((porps: { list: { link: string; name: string }[] }) => {
    const location = useLocation()
    const currentPage = location.pathname
    return (
        <ul class="space-y-6 lg:space-y-2 border-l border-slate-100 dark:border-slate-800">
            {porps.list.map((opt) => (
                <li>
                    <Link
                        class={[
                            currentPage === `${opt.link}/` ? 'font-semibold' : '',
                            'block border-l pl-4 -ml-px border-transparent hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300 ',
                        ]}
                        href={opt.link}
                    >
                        {opt.name}
                    </Link>
                </li>
            ))}
        </ul>
    )
})
