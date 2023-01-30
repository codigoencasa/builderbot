export interface addKeywordOptions {
    sensitive: boolean
}

export interface flowCtx {
    ref: string /// uuid
    keyword: string | string[]
    options: addKeywordOptions // {}
    json: Array<Omit<flowCtx, 'json'>>
}

interface AnswerOptions {
    media: string // url
    buttons: { body: string }[]
    capture: boolean
    child: any // deprecaded
    delay: number
}

export interface IaddAnswer {
    answer: string | string[]
    options?: AnswerOptions
    cb?:
        | null
        | ((
              context: {
                  body: string
                  from: string
                  [key: string]: any
              },
              param2: {
                  flowDynamic: () => any
                  endFlow: () => any
                  fallback: () => any
                  conitueFlow: () => any
              }
              /* funciones extras de bot-whatsapp */
          ) => any)
    nested?: Answer | Answer[]
}

// principal
export interface Answer {
    ctx: Answer
    toJson: Array<Omit<flowCtx, 'json'>>
    ref: string
}
