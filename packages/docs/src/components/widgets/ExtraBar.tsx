import { component$ } from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(() => {
    const { pathname } = useLocation()
    const editUrl = ` https://github.com/codigoencasa/bot-whatsapp/edit/dev/packages/docs/src/routes${pathname}index.mdx`
    return (
        <div class={'pb-3'}>
            <ul>
                <li>
                    <a target={'_blank'} class={'font-semibold'} href={editUrl}>
                        📄 Editar esta pagina
                    </a>
                    <p class={'text-xs'}>
                        Forma parte de esta comunidad mejorando la documentación siente libre de poder agregar o editar
                        lo que quieras
                    </p>
                </li>
            </ul>
        </div>
    )
})
