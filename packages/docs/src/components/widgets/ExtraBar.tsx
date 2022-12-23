import { component$ } from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(
    ({
        options = [],
    }: {
        options: { link: string; name: string; class?: string }[]
    }) => {
        const { pathname } = useLocation()
        const editUrl = ` https://github.com/codigoencasa/bot-whatsapp/edit/dev/packages/docs/src/routes${pathname}index.mdx`
        return (
            <div>
                <ul>
                    {options.map((opt) => (
                        <li class={opt.class}>
                            <a href={editUrl}>{opt.name}</a>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
)
