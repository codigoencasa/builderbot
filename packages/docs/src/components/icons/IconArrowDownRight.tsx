interface ItemProps {
    class?: string
}

export const IconArrowDownRight = (props: ItemProps) => {
    const { class: className } = props
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class={`icon icon-tabler icon-tabler-arrow-down-right ${className || 'w-5 h-5'}`}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <line x1="7" y1="7" x2="17" y2="17"></line>
            <polyline points="17 8 17 17 8 17"></polyline>
        </svg>
    )
}
