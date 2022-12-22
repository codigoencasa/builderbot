import { component$ } from '@builder.io/qwik'

// @ts-ignore
import srcsetAvif from '~/assets/images/hero.jpg?w=400;900&avif&srcset'
// @ts-ignore
import srcsetWebp from '~/assets/images/hero.jpg?w=400;900&webp&srcset'
// @ts-ignore
import { src as placeholder } from '~/assets/images/hero.jpg?width=400&metadata'

export default component$(() => {
    return (
        <section
            class={`bg-gradient-to-b md:bg-gradient-to-r from-white via-purple-50 to-sky-100 dark:bg-none mt-[-72px]`}
        >
            <div class="max-w-6xl mx-auto px-4 sm:px-6 md:flex md:h-screen 2xl:h-auto pt-[72px]">
                <div class="py-12 md:py-12 lg:py-16 block md:flex text-center md:text-left">
                    <div class="pb-12 md:pb-0 md:py-0 max-w-5xl mx-auto md:pr-16 flex items-center basis-[56%]">
                        <div>
                            <h1 class="text-5xl md:text-[3.48rem] font-bold leading-tighter tracking-tighter mb-4 font-heading px-4 md:px-0">
                                Free template for <br class="hidden lg:block" />{' '}
                                <span class="hidden lg:inline">
                                    create a website using{' '}
                                </span>{' '}
                                <span class="text-[#039de1]">Qwik</span> +{' '}
                                <span class="sm:whitespace-nowrap text-[#039de1]">
                                    Tailwind CSS
                                </span>
                            </h1>
                            <div class="max-w-3xl mx-auto">
                                <p class="text-xl text-gray-600 mb-8 dark:text-slate-400">
                                    <span class="font-semibold underline decoration-wavy decoration-1 decoration-secondary-600 underline-offset-2">
                                        Qwind
                                    </span>{' '}
                                    is a production ready template to start your
                                    new website using <em>Qwik</em> +{' '}
                                    <em>Tailwind CSS</em>. It has been designed
                                    following Best Practices, SEO,
                                    Accessibility,{' '}
                                    <span class="inline md:hidden">...</span>
                                    <span class="hidden md:inline">
                                        Dark Mode, Great Page Speed, image
                                        optimization, sitemap generation and
                                        more.
                                    </span>
                                </p>
                                <div class="max-w-xs sm:max-w-md flex flex-nowrap flex-col sm:flex-row gap-4 m-auto md:m-0 justify-center md:justify-start">
                                    <div class="flex w-full sm:w-auto">
                                        <a
                                            class="btn btn-primary sm:mb-0 w-full"
                                            href="https://github.com/onwidget/qwind"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Get template
                                        </a>
                                    </div>
                                    <div class="flex w-full sm:w-auto">
                                        <button class="btn w-full bg-gray-50 dark:bg-transparent">
                                            Learn more
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="block md:flex items-center flex-1">
                        <div class="relative m-auto max-w-4xl">
                            <picture>
                                <source srcSet={srcsetAvif} type="image/avif" />
                                <source srcSet={srcsetWebp} type="image/webp" />
                                <img
                                    src={placeholder}
                                    width={1000}
                                    height={1250}
                                    class="mx-auto w-full rounded-md md:h-full drop-shadow-2xl bg-gray-400 dark:bg-slate-700"
                                    alt="Qwind Hero Image (Cool dog)"
                                    loading="eager"
                                    decoding="async"
                                />
                            </picture>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
})
