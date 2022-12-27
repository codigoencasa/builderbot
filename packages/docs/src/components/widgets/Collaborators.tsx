import { component$, Resource, useResource$ } from '@builder.io/qwik'
import Collaborator from './Collaborator'

export const apiGetCollaborators = async () => {
    const data = fetch(
        `https://api.github.com/repos/codigoencasa/bot-whatsapp/contributors`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                Authorization:
                    'Bearer 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',
            },
        }
    )

    return (await data).json()
}

export const TaleUsers = component$((props: { users: any[] }) => {
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

export default component$(() => {
    const collaboratorsResource = useResource$(
        async () => await apiGetCollaborators()
    )

    return (
        <section class="relative ">
            <div class={'px-4 py-16 mx-auto max-w-6xl lg:py-20'}>
                <div class="mb-10 md:mx-auto sm:text-center md:mb-12 max-w-3xl">
                    <p class="text-base text-primary-600 dark:text-purple-200 font-semibold tracking-wide uppercase">
                        Colaboradores
                    </p>
                    <h2 class="text-4xl md:text-5xl font-bold leading-tighter tracking-tighter mb-4 font-heading">
                        Super estrellas
                    </h2>
                    <p class="max-w-3xl mx-auto sm:text-center text-xl text-gray-600 dark:text-slate-400">
                        Todo es posible gracias a el mayor recursos de todos, el
                        recurso humano. Tu tambien puedes formar parte
                    </p>
                </div>

                <div class="grid lg:grid-cols-12 grid-cols-1 gap-4 ">
                    <Resource
                        value={collaboratorsResource}
                        onResolved={(data) => <TaleUsers users={data} />}
                    ></Resource>
                </div>
            </div>
        </section>
    )
})
