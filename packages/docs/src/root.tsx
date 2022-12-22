import { component$, useStyles$ } from '@builder.io/qwik'
import {
    QwikCityProvider,
    RouterOutlet,
    ServiceWorkerRegister,
} from '@builder.io/qwik-city'

import { RouterHead } from '~/components/core/RouterHead'
import { DarkThemeLauncher } from '~/components/core/DarkThemeLauncher'

import fontStyles from '~/assets/styles/fonts.css?inline'
import globalStyles from '~/assets/styles/global.css?inline'

export default component$(() => {
    /**
     * The root of a QwikCity site always start with the <QwikCityProvider> component,
     * immediately followed by the document's <head> and <body>.
     *
     * Dont remove the `<head>` and `<body>` elements.
     */

    useStyles$(fontStyles)
    useStyles$(globalStyles)

    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="manifest" href="/manifest.json" />

                <RouterHead />
                <DarkThemeLauncher />
            </head>
            <body class="text-gray-900 dark:text-slate-300 tracking-tight bg-white dark:bg-gray-900 antialiased">
                <RouterOutlet />
                <ServiceWorkerRegister />
            </body>
        </QwikCityProvider>
    )
})
