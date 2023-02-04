import { component$, useContextProvider, useStore, useStyles$ } from '@builder.io/qwik'
import { QwikCityProvider, RouterOutlet, ServiceWorkerRegister } from '@builder.io/qwik-city'

import { RouterHead } from '~/components/core/RouterHead'
import { DarkThemeLauncher } from '~/components/core/DarkThemeLauncher'

import fontStyles from '~/assets/styles/fonts.css?inline'
import globalStyles from '~/assets/styles/global.css?inline'
import { DocumentationCtx, GlobalStore } from './contexts'
import { Social } from './components/core/Social'

export default component$(() => {
    /**
     * The root of a QwikCity site always start with the <QwikCityProvider> component,
     * immediately followed by the document's <head> and <body>.
     *
     * Dont remove the `<head>` and `<body>` elements.
     */

    useStyles$(fontStyles)
    useStyles$(globalStyles)

    const store = useStore<DocumentationCtx[]>([
        {
            title: 'Primeros pasos',
            list: [
                { name: 'Vista rápida', link: '/docs' },
                { name: 'Requerimientos', link: '/docs/requirements' },
                { name: 'Instalación', link: '/docs/install' },
                { name: 'Pruebalo', link: '/docs/example' },
            ],
        },
        {
            title: 'Esenciales',
            list: [
                { name: 'Conceptos', link: '/docs/essential' },
                { name: 'Conversaciones', link: '/docs/flows' },
                { name: 'Proveedores', link: '/docs/providers' },
                { name: 'Base de datos', link: '/docs/database' },
            ],
        },
        {
            title: 'Avanzado',
            list: [
                { name: 'Migración', link: '/docs/migration' },
                { name: 'MasterClass', link: '/docs/masterclass' },
            ],
        },
        {
            title: 'Despliegue',
            list: [
                { name: 'Local', link: '/docs/deploy/local' },
                { name: 'Docker', link: '/docs/deploy/docker' },
                { name: 'Cloud', link: '/docs/deploy/cloud' },
            ],
        },
        {
            title: 'Comunidad',
            list: [
                { name: 'Colabores', link: '/docs/contributing' },
                { name: 'Unirme al proyecto', link: '/docs/join' },
            ],
        },
    ])

    useContextProvider(GlobalStore, store)

    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/manifest.json" />

                <RouterHead />
                <DarkThemeLauncher />
                <Social />
            </head>
            <body class="text-gray-900 dark:text-slate-300 tracking-tight bg-white dark:bg-gray-900 antialiased">
                <RouterOutlet />
                <ServiceWorkerRegister />
            </body>
        </QwikCityProvider>
    )
})
