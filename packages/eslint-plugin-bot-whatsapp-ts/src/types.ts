export interface INode {
    type: string
    callee?: {
        property?: {
            name?: string
        }
    }
    parent?: Parent
}

export interface Parent {
    type: string
    callee?: {
        property?: {
            name?: string
        }
    }
}

export interface ReportOptions {
    node: INode
    message: string
    fix: (fixer: any) => void
}

export interface Context {
    report: (options: ReportOptions) => void
}
