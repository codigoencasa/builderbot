import {
    component$,
    useClientEffect$,
    useStore,
    useStylesScoped$,
} from '@builder.io/qwik'
import { useLocation } from '@builder.io/qwik-city'
import style from './qr.css?inline'

export const QR = component$(() => {
    useStylesScoped$(style)
    const state = useStore({
        count: 0,
    })

    useClientEffect$(() => {
        setInterval(() => {
            state.count++
        }, 800)
    })

    const location = useLocation()
    const qrImage = location.query?.qr ?? 'qr.png'

    return (
        <div>
            <img
                width={350}
                height={350}
                src={qrImage + '?time=' + state.count}
                alt="QR"
            />
        </div>
    )
})
