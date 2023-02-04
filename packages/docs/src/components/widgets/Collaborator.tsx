import { component$ } from '@builder.io/qwik'

export default component$(
    (props: {
        user: {
            id: number
            login: string
            html_url: string
            avatar_url: string
        }
    }) => {
        return (
            <figure class="bg-gray-50 rounded p-4  dark:bg-slate-800">
                <a href={props.user.html_url} target="_blank">
                    <img
                        class="w-16 h-16 rounded-full mx-auto object-cover"
                        src={props.user.avatar_url}
                        alt={props.user.login}
                        width="80"
                        height="80"
                    />
                </a>

                <div class="pt-2 space-y-4 justify-center flex">
                    <figcaption class="text-sm">
                        <div class={'font-semibold truncate'}>{props.user.login}</div>
                    </figcaption>
                </div>
            </figure>
        )
    }
)
