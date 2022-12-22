import { component$ } from '@builder.io/qwik'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(
    ({
        options = [],
    }: {
        options: { link: string; name: string; class?: string }[]
    }) => {
        return (
            <div>
                <ul>
                    {options.map((opt) => (
                        <li class={opt.class}>
                            <a href={opt.link}>{opt.name}</a>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
)
