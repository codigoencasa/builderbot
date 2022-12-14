import { staticAdaptor } from '@builder.io/qwik-city/adaptors/static/vite'
import { extendConfig } from '@builder.io/qwik-city/vite'
import baseConfig from '../../vite.config'

import { SITE } from '../../src/config.mjs'

export default extendConfig(baseConfig, () => {
    return {
        build: {
            ssr: true,
            rollupOptions: {
                input: ['@qwik-city-plan'],
            },
        },
        plugins: [
            staticAdaptor({
                origin: SITE.origin,
            }),
        ],
    }
})
