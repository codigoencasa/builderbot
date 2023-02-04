interface ItemProps {
    class?: string
}

export const IconMenu = (props: ItemProps) => {
    const { class: className } = props
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            class={`icon icon-tabler icon-tabler-menu ${className || 'w-5 h-5'}`}
            preserveAspectRatio="xMidYMid meet"
            viewBox="0 0 24 24"
        >
            <g
                class="icon-tabler"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M4 8h16"></path>
                <path d="M4 16h16"></path>
            </g>
        </svg>
    )
}
