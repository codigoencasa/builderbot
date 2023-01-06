import { component$ } from '@builder.io/qwik'
import { Link } from '@builder.io/qwik-city'

import { IconTwitter } from '~/components/icons/IconTwitter'
import { IconGithub } from '~/components/icons/IconGithub'
import { Netlify } from '../atoms/Netlify'

export default component$(() => {
    const social = [
        {
            label: 'Twitter',
            icon: IconTwitter,
            href: 'https://twitter.com/leifermendez',
        },
        {
            label: 'Github',
            icon: IconGithub,
            href: 'https://github.com/codigoencasa/bot-whatsapp',
        },
    ]

    return (
        <footer class="">
            <div class="max-w-6xl mx-auto px-4 sm:px-6">
                <div class="grid grid-cols-12 gap-4 gap-y-8 sm:gap-8 py-8 md:py-12">
                    <div class="col-span-12 lg:col-span-4 pr-8">
                        <div class="text-sm text-gray-600 dark:text-gray-400"></div>
                    </div>
                    <div class="col-span-12 flex justify-center lg:col-span-4 pr-8">
                        <div class={'flex flex-col justify-center gap-1'}>
                            <a target={'_blank'} href="https://www.netlify.com">
                                <Netlify />
                            </a>
                        </div>
                    </div>
                </div>
                <div class="md:flex md:items-center md:justify-between py-6 md:py-8">
                    <ul class="flex mb-4 md:order-1 -ml-2 md:ml-4 md:mb-0">
                        {social.map(({ label, href, icon: Icon }) => (
                            <li>
                                <Link
                                    class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-sm p-2.5 inline-flex items-center"
                                    aria-label={label}
                                    title={label}
                                    href={href}
                                >
                                    {Icon && <Icon />}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* <div class="text-sm text-gray-700 mr-4 dark:text-slate-400">
                        <span class="w-5 h-5 md:w-6 md:h-6 md:-mt-0.5 bg-cover mr-1.5 float-left rounded-sm bg-[url(https://onwidget.com/favicon/favicon-32x32.png)]"></span>
                        Made by{' '}
                        <a
                            class="text-secondary-700 hover:underline dark:text-gray-200"
                            href="https://onwidget.com/"
                        >
                            {' '}
                            onWidget
                        </a>{' '}
                        · All rights reserved.
                    </div> */}
                </div>
            </div>
        </footer>
    )
})
