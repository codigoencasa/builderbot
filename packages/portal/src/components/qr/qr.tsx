import { component$, useClientEffect$, useStore, useStylesScoped$ } from '@builder.io/qwik'
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

    return (
        <div>
            <img width={350} height={350} src={'qr.png?time=' + state.count} alt="QR" />
        </div>
    )
})
