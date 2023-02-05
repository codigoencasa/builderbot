import { component$ } from '@builder.io/qwik'
import { IconStar } from '~/components/icons/IconStar'

export default component$(() => {
    const items = [
        [
            {
                title: 'Atención al cliente rápida y eficiente',
                description:
                    'El chatbot puede ayudar a tus clientes a obtener respuestas a sus preguntas o solucionar problemas de manera rápida y sencilla, sin tener que esperar horas o incluso días por una respuesta.',
            },
            {
                title: 'Automatización de tareas repetitiva',
                description:
                    'Se pueden automatizar tareas repetitivas y ahorrar tiempo y esfuerzo en tareas administrativas, como enviar recordatorios a tus clientes sobre pagos pendientes o para confirmar citas o reservas.',
            },
            {
                title: 'Experiencia personalizada',
                description:
                    'Podrás enviar mensajes automatizados con ofertas especiales o recomendaciones de productos basadas en el historial de compras de tus clientes, lo que significa que tus clientes pueden recibir una experiencia más personalizada.',
            },
        ],
        [
            {
                title: 'Análisis de datos',
                description:
                    'Te permite recopilar y analizar datos sobre tus clientes para ayudarte a entender mejor sus necesidades y preferencias, y ofrecerles un servicio aún más destacado.',
                icon: 'tabler:rocket',
            },
            {
                title: 'Mejora de la eficiencia',
                description:
                    'Te brinda la facilidad de manejar varias conversaciones al mismo tiempo, lo que significa que tus clientes no tendrán que esperar en una larga cola de mensajes para obtener atención. Esto puede ayudar a mejorar la eficiencia y la productividad en tu negocio.',
                icon: 'tabler:arrows-right-left',
            },
            {
                title: 'Personalización y adaptación',
                description:
                    'Como proyecto open source, el chatbot de WhatsApp es totalmente personalizable y puede ser adaptado a las necesidades específicas de tu negocio o proyecto. Esto significa que puedes modificar el código fuente y adaptar el chatbot a tus necesidades exactas.',
                icon: 'tabler:bulb',
            },
        ],
    ]

    return (
        <section class="scroll-mt-16" id="features">
            <div class="px-4 py-16 mx-auto max-w-6xl lg:px-8 lg:py-20">
                <div class="mb-10 md:mx-auto sm:text-center md:mb-12 max-w-3xl">
                    <p class="text-base text-primary-600 dark:text-purple-200 font-semibold tracking-wide uppercase">
                        Caracteristicas
                    </p>
                    <h2 class="text-4xl md:text-5xl font-bold leading-tighter tracking-tighter mb-4 font-heading">
                        Nuestras principales <span class="whitespace-nowrap">funciones</span>
                    </h2>
                    <p class="max-w-3xl mx-auto sm:text-center text-xl text-gray-600 dark:text-slate-400">
                        El secreto es mantener los procesos repetitivos en procesos automatizados simples, por eso te
                        mostramos en que destacamos.
                    </p>
                </div>
                <div class="grid mx-auto space-y-6 md:grid-cols-2 md:space-y-0">
                    {items.map((subitems) => (
                        <div class="space-y-8 sm:px-8">
                            {subitems.map(({ title, description }) => (
                                <div class="flex flex-row max-w-md">
                                    <div class="mb-4 mr-4">
                                        <div class="text-white flex items-center justify-center w-12 h-12 rounded-full bg-primary-500 dark:bg-primary-500">
                                            <IconStar />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 class="mb-3 text-xl font-bold">{title}</h3>
                                        <p class="text-gray-600 dark:text-slate-400">{description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
})
