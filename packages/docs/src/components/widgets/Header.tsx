import { component$, useContext, useStore } from '@builder.io/qwik'
import Logo from '~/components/atoms/Logo'
import { IconGithub } from '~/components/icons/IconGithub'
import ToggleTheme from '~/components/core/ToggleTheme'
import ToggleMenu from '~/components/core/ToggleMenu'
import { IconDiscord } from '../icons/IconDiscord'
import { GlobalStore } from '~/contexts'

export default component$(() => {
    const storeScroll = useStore({
        isScrolling: false,
    })

    const store = useContext(GlobalStore)

    return (
        <header
            class={`sticky top-0 z-40 flex-none mx-auto w-full transition-all border border-b-slate-100 dark:border-b-slate-800 border-x-0 border-t-0 ${
                storeScroll.isScrolling
                    ? ' md:bg-white/90 md:backdrop-blur-sm dark:md:bg-slate-900/90 bg-white dark:bg-slate-900'
                    : ''
            }`}
            id="header"
            window:onScroll$={() => {
                if (!storeScroll.isScrolling && window.scrollY >= 10) {
                    storeScroll.isScrolling = true
                } else if (storeScroll.isScrolling && window.scrollY < 10) {
                    storeScroll.isScrolling = false
                }
            }}
        >
            <div class="py-3 px-3 mx-auto w-full md:flex md:justify-between max-w-6xl md:px-4">
                <div class="flex justify-between">
                    <a class="flex items-center" href={'/'}>
                        <Logo />
                    </a>
                    <div class="flex items-center md:hidden">
                        <ToggleTheme iconClass="w-6 h-6" />
                        <ToggleMenu iconClass="w-6 h-6" />
                    </div>
                </div>
                <nav
                    class="items-center w-full md:w-auto hidden md:flex text-gray-600 dark:text-slate-200 h-[calc(100vh-100px)] md:h-auto overflow-y-auto md:overflow-visible"
                    aria-label="Main navigation"
                >
                    <ul class="flex flex-col pt-8 md:pt-0 md:flex-row md:self-center w-full md:w-auto text-xl md:text-base">
                        <li class="dropdown">
                            <a
                                href="/docs"
                                class="font-medium hover:text-gray-900 dark:hover:text-white px-4 py-3 flex items-center transition duration-150 ease-in-out"
                            >
                                Documentación
                            </a>
                            <ul class="dropdown-menu rounded md:absolute pl-4 md:pl-0 md:hidden font-medium md:bg-white md:min-w-[200px] dark:md:bg-slate-800 drop-shadow-xl">
                                {store.map((ctx) => {
                                    return ctx.list.map((listCtx) => {
                                        return (
                                            <li>
                                                <a
                                                    class="font-medium rounded-t md:hover:bg-gray-100 dark:hover:bg-gray-700 py-2 px-4 block whitespace-no-wrap"
                                                    href={listCtx.link}
                                                >
                                                    {listCtx.name}
                                                </a>
                                            </li>
                                        )
                                    })
                                })}
                            </ul>
                        </li>
                        {/* <li>
                            <a
                                target={'_blank'}
                                class="font-medium hover:text-gray-900 dark:hover:text-white px-4 py-3 flex items-center transition duration-150 ease-in-out"
                                href={
                                    'https://codigoencasa.com/tag/bot-whatsapp/'
                                }
                            >
                                Blog
                            </a>
                        </li> */}
                        <li class="md:hidden">
                            <a
                                target={'_blank'}
                                class="font-bold hover:text-gray-900 dark:hover:text-white px-4 py-3 flex items-center transition duration-150 ease-in-out"
                                href="https://github.com/codigoencasa/bot-whatsapp"
                            >
                                Github
                            </a>
                        </li>
                    </ul>
                    <div class="md:self-center flex items-center mb-4 md:mb-0 ml-2">
                        <div class="hidden items-center md:flex">
                            <ToggleTheme />
                            <a
                                target={'_blank'}
                                href="https://link.codigoencasa.com/DISCORD"
                                class="inline-block text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-sm p-2.5"
                                aria-label="Qwind Github"
                            >
                                <IconDiscord />
                            </a>
                            <a
                                target={'_blank'}
                                href="https://github.com/codigoencasa/bot-whatsapp"
                                class="inline-block text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-sm p-2.5"
                                aria-label="Qwind Github"
                            >
                                <IconGithub />
                            </a>
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    )
})
