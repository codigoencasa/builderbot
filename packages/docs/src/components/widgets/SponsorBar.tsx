import { component$ } from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'

// @ts-ignore
import { src as qwik } from '~/assets/images/qwik.png?width=100&metadata'
// @ts-ignore
import { src as leanga } from '~/assets/images/leanga.png?width=40&metadata'
// @ts-ignore
import { src as netlify } from '~/assets/images/full-logo-light.png?width=100&metadata'
// @ts-ignore
import { src as digitalOcean } from '~/assets/images/digital-ocean.png?width=100&metadata'

/**
 * options = [] array con la lista de opciones de la documentacion
 */
export default component$(() => {
    const { pathname } = useLocation()
    const editUrl = ` https://github.com/codigoencasa/bot-whatsapp/edit/dev/packages/docs/src/routes${pathname}index.mdx`
    return (
        <div>
            <ul>
                <li>
                    <a target={'_blank'} class={'font-semibold'} href={editUrl}>
                        🙌 Sponsors
                    </a>
                </li>
                <li>
                    <a target={'_blank'} href="https://qwik.builder.io/">
                        <picture>
                            <img
                                src={qwik}
                                class="border border-slate-200 rounded my-2 p-1 bg-gray-50  dark:border-gray-600 dark:bg-gray-700"
                                alt="Qwind Hero Image (Cool dog)"
                                loading="eager"
                                decoding="async"
                            />
                        </picture>
                    </a>
                </li>
                <li>
                    <a target={'_blank'} href="https://www.netlify.com">
                        <picture>
                            <img
                                src={netlify}
                                class="border border-slate-200 rounded my-2 p-1 bg-gray-50  dark:border-gray-600 dark:bg-gray-700"
                                alt="Netlify"
                                loading="eager"
                                decoding="async"
                            />
                        </picture>
                    </a>
                </li>
                <li>
                    <a target={'_blank'} href="https://m.do.co/c/140291d21736">
                        <picture>
                            <img
                                src={digitalOcean}
                                class="border border-slate-200 rounded my-2 p-1 bg-gray-50  dark:border-gray-600 dark:bg-gray-700"
                                alt="DigitalOcean"
                                loading="eager"
                                decoding="async"
                            />
                        </picture>
                    </a>
                </li>
                <li>
                    <a target={'_blank'} href="https://leangasoftware.es/">
                        <picture>
                            <img
                                src={leanga}
                                class="border border-slate-200 rounded my-2 p-1 bg-gray-50  dark:border-gray-600 dark:bg-gray-700"
                                alt="Qwind Hero Image (Cool dog)"
                                loading="eager"
                                decoding="async"
                            />
                        </picture>
                    </a>
                </li>
            </ul>
        </div>
    )
})
