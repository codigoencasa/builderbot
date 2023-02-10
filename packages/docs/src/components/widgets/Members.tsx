import { component$ } from '@builder.io/qwik'
import { RequestHandlerCloudflarePages } from '@builder.io/qwik-city/middleware/cloudflare-pages'
import { User } from '~/contexts'
import Collaborator from './Collaborator'

export const onRequest: RequestHandlerCloudflarePages = async () => {
    console.log('??heree')
}

export const TaleUsers = component$((props: { users: User[] }) => {
    return (
        <>
            {props.users.map((user) => (
                <div class="col-span-2 ">
                    {' '}
                    <Collaborator user={user} />
                </div>
            ))}
        </>
    )
})

export default component$((props: { users: User[] }) => {
    return (
        <section class="relative ">
            <div class={'px-4 py-16 mx-auto max-w-6xl lg:py-20'}>
                <div class="mb-10 md:mx-auto sm:text-center md:mb-12 max-w-3xl">
                    <p class="text-base text-primary-600 dark:text-purple-200 font-semibold tracking-wide uppercase">
                        Premium
                    </p>
                    <h2 class="text-4xl md:text-5xl font-bold leading-tighter tracking-tighter mb-4 font-heading">
                        Miembros
                    </h2>
                    <p class="max-w-3xl mx-auto sm:text-center text-xl text-gray-600 dark:text-slate-400">
                        Conviértete en un miembro destacado y forma parte del proyecto y disfruta de manera adelantada
                        de las actualizaciones{' '}
                        <a class={'font-semibold'} target={'_blank'} href="https://opencollective.com/bot-whatsapp">
                            Únete
                        </a>
                    </p>
                </div>

                <div class="grid lg:grid-cols-12 grid-cols-1 gap-4 ">
                    <TaleUsers users={props.users} />
                </div>
            </div>
        </section>
    )
})
