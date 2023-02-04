import { component$ } from '@builder.io/qwik'
import { IconArrowDownRight } from '../icons/IconArrowDownRight'

export default component$(() => {
    const items = [
        [
            {
                question: '¿Que necesitas para iniciar?',
                answer: `Deseable tener conocimientos previos en JavaScript o ejecución de proyectos Node. La comunidad siempre se encargará de mantener la documentación lo más clara posible para que con solo unos minutos tengas tu chatbot funcionando correctamente`,
            },
            {
                question: '¿Es Gratis?',
                answer: `Si. Es un proyecto Open Source que ofrece el código para que puedas aplicarlo de manera totalmente gratuita. Siempre destacando el valor aportado por toda la comunidad`,
            },
            {
                question: '¿Funciona en Ubuntu/Windows?',
                answer: `El proyecto funciona perfectamente Linux/Windows/Mac. Cabe destacar que dependiendo del sistema operativo será necesario realizar algunos ajustes puntuales. En la documentación se explica más estos casos de usos`,
            },
        ],
        [
            {
                question: '¿Existe un plan de pago?',
                answer: `Actualmente, no contamos con un plan de pago, las aportaciones económicas recibidas se destinan a gastos en comunes: servidores para pruebas, servicios de api externos, recursos de marketing y diseño, recintos para capacitaciones, entre otras cosas.`,
            },
            {
                question: '¿Riesgos dé bloqueo?',
                answer: `Depende. Esta librería es una capa superior agnóstica al proveedor que facilita el escribir flujos de conversación. Esto significa que la conexión con "Whatsapp" es delegada al proveedor de turno, el cual dependiendo de cuál elijas, puede tener limitaciones o riesgos. Ver más información`,
            },
            {
                question: '¿Casos de usos?',
                answer: `Basado en los relatos compartidos por la comunidad, hasta el momento hemos registrado más de 100 casos de usos. Los más populares suelen ser: asistencia técnica. (preguntas y respuestas), gestión de pedidos de restaurantes, chatbot con inteligencia artificial gracias a dialogflow`,
            },
        ],
    ]

    return (
        <section class="">
            <div class="px-4 py-16 mx-auto max-w-6xl lg:py-20">
                <div class="max-w-xl sm:mx-auto lg:max-w-2xl">
                    <div class="max-w-xl mb-10 md:mx-auto sm:text-center lg:max-w-2xl md:mb-12">
                        <p class="text-base text-primary-600 dark:text-purple-200 font-semibold tracking-wide uppercase">
                            FAQs
                        </p>
                        <h2 class="max-w-lg mb-4 text-3xl font-bold leading-none tracking-tight sm:text-4xl md:mx-auto font-heading">
                            Preguntas Frecuentes
                        </h2>
                    </div>
                </div>
                <div class="max-w-screen-xl sm:mx-auto">
                    <div class="grid grid-cols-1 gap-x-8 gap-y-8 lg:gap-x-16 md:grid-cols-2">
                        {items.map((subitems) => (
                            <div class="space-y-8">
                                {subitems.map(({ question, answer }) => (
                                    <div>
                                        <div class="mb-4 text-xl font-bold">
                                            <IconArrowDownRight class="w-7 h-7 text-primary-600  inline-block" />
                                            {question}
                                        </div>
                                        {answer.split('\n\n').map((paragraph) => (
                                            <p class="text-gray-700 dark:text-gray-400 mb-2">{paragraph}</p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
})
