import { component$ } from '@builder.io/qwik'

export const SearchModal = component$(() => {
    // const state = useStore({
    //     open: false,
    //     src: '',
    // })

    return (
        <div class={'bg-gray-100/75  fixed w-[100vw] h-[100vh] z-50'}>
            <div class={'bg-red-200 w-1/3 m-auto mt-12'}>
                <SingleModal />
            </div>
        </div>
    )
})

export const SingleModal = component$(() => {
    return <div class={'bg-blue-300 w-100 px-3 py-2'}>Modal singlke</div>
})
