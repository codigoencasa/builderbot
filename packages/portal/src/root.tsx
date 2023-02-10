import { component$, useStyles$ } from '@builder.io/qwik'
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city'
import { RouterHead } from './components/router-head/router-head'

import globalStyles from './global.css?inline'

export default component$(() => {
    /**
     * The root of a QwikCity site always start with the <QwikCityProvider> component,
     * immediately followed by the document's <head> and <body>.
     *
     * Dont remove the `<head>` and `<body>` elements.
     */
    useStyles$(globalStyles)

    return (
        <QwikCityProvider>
            <head>
                <meta charSet="utf-8" />
                <link rel="preconnect" href="https://rsms.me/" />
                <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
                <RouterHead />
            </head>
            <body lang="en">
                <RouterOutlet />
            </body>
        </QwikCityProvider>
    )
})
