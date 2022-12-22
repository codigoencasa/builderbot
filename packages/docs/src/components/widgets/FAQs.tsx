import { component$ } from '@builder.io/qwik'
import { IconArrowDownRight } from '../icons/IconArrowDownRight'

export default component$(() => {
    const items = [
        [
            {
                question: 'What do I need to start?',
                answer: `Space, the final frontier. These are the voyages of the Starship Enterprise. Its five-year mission: to explore strange new worlds.

    Many say exploration is part of our destiny, but it’s actually our duty to future generations.`,
            },
            {
                question: 'How to install the Qwik + Tailwind CSS template?',
                answer: `Well, the way they make shows is, they make one show. That show's called a pilot.

    Then they show that show to the people who make shows, and on the strength of that one show they decide if they're going to make more shows. Some pilots get picked and become television programs. Some don't, become nothing. She starred in one of the ones that became nothing.`,
            },
            {
                question:
                    "What's something that you completely don't understand?",
                answer: `A flower in my garden, a mystery in my panties. Heart attack never stopped old Big Bear. I didn't even know we were calling him Big Bear.`,
            },
        ],
        [
            {
                question: "What's an example of when you changed your mind?",
                answer: `Michael Knight a young loner on a crusade to champion the cause of the innocent. The helpless. The powerless in a world of criminals who operate above the law. Here he comes Here comes Speed Racer. He's a demon on wheels.`,
            },
            {
                question:
                    'What is something that you would really like to try again?',
                answer: `A business big enough that it could be listed on the NASDAQ goes belly up. Disappears!

      It ceases to exist without me. No, you clearly don't know who you're talking to, so let me clue you in.`,
            },
            {
                question:
                    'If you could only ask one question to each person you meet, what would that question be?',
                answer: `This is not about revenge. This is about justice. A lot of things can change in twelve years, Admiral. Well, that's certainly good to know. About four years. I got tired of hearing how young I looked.`,
            },
        ],
    ]

    return (
        <section class="border-t border-gray-200 dark:border-slate-800">
            <div class="px-4 py-16 mx-auto max-w-6xl lg:py-20">
                <div class="max-w-xl sm:mx-auto lg:max-w-2xl">
                    <div class="max-w-xl mb-10 md:mx-auto sm:text-center lg:max-w-2xl md:mb-12">
                        <p class="text-base text-primary-600 dark:text-purple-200 font-semibold tracking-wide uppercase">
                            FAQs
                        </p>
                        <h2 class="max-w-lg mb-4 text-3xl font-bold leading-none tracking-tight sm:text-4xl md:mx-auto font-heading">
                            Frequently Asked Questions
                        </h2>
                    </div>
                </div>
                <div class="max-w-screen-xl sm:mx-auto">
                    <div class="grid grid-cols-1 gap-x-8 gap-y-8 lg:gap-x-16 md:grid-cols-2">
                        {items.map((subitems) => (
                            <div class="space-y-8">
                                {subitems.map(({ question, answer }) => (
                                    <div>
                                        <p class="mb-4 text-xl font-bold">
                                            <IconArrowDownRight class="w-7 h-7 text-secondary-500 inline-block" />
                                            {question}
                                        </p>
                                        {answer
                                            .split('\n\n')
                                            .map((paragraph) => (
                                                <p class="text-gray-700 dark:text-gray-400 mb-2">
                                                    {paragraph}
                                                </p>
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
