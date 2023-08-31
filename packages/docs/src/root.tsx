import { component$, useContextProvider, useStore, useStyles$ } from '@builder.io/qwik'
import { QwikCityProvider, RouterOutlet, ServiceWorkerRegister } from '@builder.io/qwik-city'

import { RouterHead } from '~/components/core/RouterHead'
import { DarkThemeLauncher } from '~/components/core/DarkThemeLauncher'

import fontStyles from '~/assets/styles/fonts.css?inline'
import globalStyles from '~/assets/styles/global.css?inline'
import { DocumentationCtx, ExpertStore, GlobalStore, User } from './contexts'
import { Social } from './components/core/Social'
// @ts-ignore
import { src as freddyAvatar } from '~/assets/images/freddy.png?width=150&metadata'
// @ts-ignore
import { src as carlosAvatar } from '~/assets/images/carlos.png?width=150&metadata'

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
                { name: 'Conceptos', link: '/docs/essential' },
            ],
        },
        {
            title: '@bot/core',
            list: [
                { name: 'addKeyword', link: '/docs/add-keyword' },
                { name: 'addAnswers', link: '/docs/add-answers' },
                { name: 'addAction', link: '/docs/add-action' },
                { name: 'ctx', link: '/docs/ctx' },
                { name: 'state', link: '/docs/state' },
                { name: 'flowDynamic', link: '/docs/flow-dynamic' },
                { name: 'fallBack', link: '/docs/fall-back' },
                { name: 'endFlow', link: '/docs/end-flow' },
                { name: 'gotoFlow', link: '/docs/goto-flow' },
            ],
        },
        {
            title: '@bot/provider',
            list: [
                { name: 'Meta', link: '/docs/provider-meta' },
                { name: 'Twilio', link: '/docs/provider-twilio' },
                { name: 'Baileys', link: '/docs/provider-baileys' },
                { name: 'Venom', link: '/docs/provider-venom' },
                { name: 'WPPConnect', link: '/docs/provider-wppconnect' },
                { name: 'Whatsapp-web.js', link: '/docs/provider-wweb' }
            ],
        },
        // {
        //     title: '@bot/database',
        //     list: [
        //         { name: 'Memory', link: '/docs/database-memory' },
        //         { name: 'Json', link: '/docs/database-json' },
        //         { name: 'Mongo', link: '/docs/database-mongo' },
        //         { name: 'MySQL', link: '/docs/database-mysql' }
        //     ],
        // },
        {
            title: 'Despliegue',
            list: [
                { name: 'Local', link: '/docs/deploy/local' },
                { name: 'Docker', link: '/docs/deploy/docker' },
                { name: 'Cloud', link: '/docs/deploy/cloud' },
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
            title: 'Comunidad',
            list: [
                { name: 'Colabores', link: '/docs/contributing' },
                { name: 'Unirme al proyecto', link: '/docs/join' },
            ],
        },
    ])

    const expertsStore = useStore<User[]>([
        {
            id: 1,
            login: 'Fredy Alejandro Gonzalez',
            html_url: 'https://app.codigoencasa.com/market/bot-expert-fredy',
            avatar_url: freddyAvatar,
            description:'Experto es un desarrollador de chatbots con más de 4 años de experiencia en la automatización de procesos de atención al cliente en línea. Tiene un amplio conocimiento en el uso de herramientas de inteligencia artificial y aprendizaje automático para mejorar la experiencia del usuario'
        },
        {
            id: 2,
            login: 'Carlos Morán',
            html_url: 'https://app.codigoencasa.com/market/bot-expert-carlos',
            avatar_url: carlosAvatar,
            description:'Conocido por su creatividad e innovación en la solución de problemas. Su habilidad para generar ideas frescas y originales lo hace un colaborador valioso en equipos de desarrollo. Innovador y capaz para pensar fuera de lo convencional lo hacen un recurso inestimable.'
        }
    ])

    useContextProvider(GlobalStore, store)
    useContextProvider(ExpertStore, expertsStore)

    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/manifest.json" />
                {/* <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@docsearch/css@3" /> */}
                {/* <script src="https://cdn.jsdelivr.net/npm/@docsearch/js@3"></script> */}
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
