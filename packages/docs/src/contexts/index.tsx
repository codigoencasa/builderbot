import { createContext } from '@builder.io/qwik'

export interface DocumentationCtx {
    title: string
    link?: string
    list: { link: string; name: string }[]
}

export interface User {
    id: number
    login: string
    html_url: string
    avatar_url: string
}

export const GlobalStore = createContext<DocumentationCtx[]>('documentation-site')
