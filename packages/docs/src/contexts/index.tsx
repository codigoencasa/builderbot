import { createContext } from '@builder.io/qwik'

export interface DocumentationCtx {
    title: string
    link?: string
    list: { link: string; name: string }[]
}

export const GlobalStore =
    createContext<DocumentationCtx[]>('documentation-site')
