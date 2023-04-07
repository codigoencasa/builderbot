import { component$ } from '@builder.io/qwik'

// @ts-ignore
import srcsetAvif from '~/assets/images/chatbot-whatsapp.png?w=400;900&avif&srcset'
// @ts-ignore
import srcsetWebp from '~/assets/images/chatbot-whatsapp.png?w=400;900&webp&srcset'
// @ts-ignore
import { src as placeholder } from '~/assets/images/chatbot-whatsapp.png?width=400&metadata'

export default component$(() => {
    return (
        <section class={` from-white via-purple-50 to-sky-100 dark:bg-none mt-[-95px]`}>
            <div class="max-w-6xl mx-auto px-4 sm:px-6 md:flex md:h-screen 2xl:h-auto pt-[72px]">
                <div class="py-12 md:py-12 lg:py-16 block md:flex text-center md:text-left">
                    <div class="pb-12 md:pb-0 md:py-0 max-w-5xl mx-auto md:pr-16 flex items-center basis-[56%]">
                        <div>
                            <h1 class="text-5xl md:text-[3.48rem] font-bold leading-tighter tracking-tighter mb-4 font-heading px-4 md:px-0">
                                Buscas un
                                <br class="hidden lg:block" /> <span class="sm:whitespace-nowrap text-[#25b637]">experto</span> <span class="lg:inline">en minutos</span>
                            </h1>
                            <div class="max-w-3xl mx-auto">
                                <p class="text-xl text-gray-600 mb-8 dark:text-slate-400">

                                <span class="font-semibold">Sabemos lo importante que es contar con una solución rápida y efectiva ante cualquier problema tecnológico que se nos presente.</span>  Por ello, hemos creado un servicio de asesoramiento en línea para brindarle a nuestros clientes la oportunidad de conectarse con expertos altamente calificados.

                                </p>

                                <div class="max-w-xs sm:max-w-md flex flex-nowrap flex-col sm:flex-col gap-4 m-auto md:m-0 justify-center md:justify-start">
                              
                                    <div class="flex w-full sm:w-auto gap-3">
                                        <a href="/experts#expert-section" class="btn  bg-gray-50 dark:bg-transparent">
                                            Ver expertos
                                        </a>
                                        <a
                                            target={'_blank'}
                                            href="https://app.codigoencasa.com/courses/curso-chatbot-whatsapp?refCode=LEIFERMENDEZ"
                                            class="btn  bg-gray-50 dark:bg-transparent"
                                        >
                                            Ver curso
                                        </a>
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
                                    class="mx-auto w-full rounded-md md:h-full drop-shadow-2xl"
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
