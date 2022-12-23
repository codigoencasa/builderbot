import { component$ } from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(
    ({ options = [] }: { options: { link: string; name: string }[] }) => {
        const location = useLocation()
        const currentPage = location.pathname
        return (
            <div>
                <ul>
                    {options.map((opt) => (
                        <li>
                            <a
                                class={
                                    currentPage === `${opt.link}/`
                                        ? 'font-semibold'
                                        : ''
                                }
                                href={opt.link}
                            >
                                {opt.name}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
)
