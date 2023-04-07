import { component$ } from '@builder.io/qwik'

export default component$(
    (props: {
        user: {
            id: number
            login: string
            html_url: string
            avatar_url: string,
            description?:string
        }
    }) => {
        return (
            <figure class="bg-white shadow-gray-400/10 shadow-xl  transition  ease-in-outrounded p-4  dark:bg-slate-800">
                <a href={props.user.html_url} target="_blank">
                    <img
                        class="w-32 h-32 rounded-full mx-auto object-cover"
                        src={props.user.avatar_url}
                        alt={props.user.login}
                        width="150"
                        height="150"
                    />
                </a>

                <div class="pt-2 space-y-4 justify-center flex">
                    <figcaption class="text-sm">
                        <div class={'font-semibold truncate'}>{props.user.login}</div>
                    </figcaption>
                </div>
                <div class="pt-2 space-y-4 justify-center flex">
                    <figcaption class="text-sm">
                        <div class={'max-w-xs'}>{props.user.description}</div>
                    </figcaption>
                </div>
            </figure>
        )
    }
)
