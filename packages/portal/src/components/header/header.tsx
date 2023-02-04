import { component$, useStylesScoped$ } from '@builder.io/qwik'
import { BotLogo } from '../icons/bot'
import styles from './header.css?inline'

export default component$(() => {
    useStylesScoped$(styles)

    return (
        <header>
            <div class="logo">
                <a href="https://github.com/codigoencasa/bot-whatsapp" target="_blank" title="qwik">
                    <BotLogo />
                </a>
            </div>
            <ul>
                <li>
                    <a href="https://github.com/codigoencasa/bot-whatsapp" target="_blank">
                        Docs
                    </a>
                </li>
                <li>
                    <a href="https://github.com/codigoencasa/bot-whatsapp/tree/main/starters/apps" target="_blank">
                        Examples
                    </a>
                </li>
                <li>
                    <a
                        href="https://www.youtube.com/watch?v=1u0TTbjK5bo&list=PL_WGMLcL4jzViIlmyDZPnhAdkc8RXGkFh"
                        target="_blank"
                    >
                        Tutorials
                    </a>
                </li>
            </ul>
        </header>
    )
})
