import { generateRef } from '../../utils/hash';
import { addAnswer, AddAnswerResult } from './addAnswer'; // Asumiendo que addAnswer tiene un tipo de retorno definido como AddAnswerResult
import { toJson } from './toJson';

interface Options {
    sensitive?: boolean;
    regex?: boolean;
}

interface KeywordContext {
    ref: string;
    keyword: string | string[];
    options: Options;
    json: any[]; // Reemplazar `any` con un tipo más específico si es posible
}

interface AddKeywordResult {
    ctx: KeywordContext;
    ref: string;
    addAnswer: AddAnswerResult;
    addAction: (cb?: Function | object, flagCb?: Function) => AddAnswerResult;
    toJson: ReturnType<typeof toJson>;
}

const addKeyword = (keyword: string | string[], options: Options = {}): AddKeywordResult => {
    if (typeof keyword !== 'string' && !Array.isArray(keyword)) {
        throw new Error('DEBE_SER_STRING_ARRAY_REGEX');
    }

    const parseOptions = (): Options => {
        const defaultProperties: Options = {
            sensitive: typeof options.sensitive === 'boolean' ? options.sensitive : false,
            regex: typeof options.regex === 'boolean' ? options.regex : false,
        };

        return defaultProperties;
    };

    const ctxAddKeyword = (): KeywordContext => {
        const ref = `key_${generateRef()}`;
        const parsedOptions = parseOptions();
        const json = [
            {
                ref,
                keyword,
                options: parsedOptions,
            },
        ];
        return { ref, keyword, options: parsedOptions, json };
    };

    const ctx = ctxAddKeyword();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
        addAction: (cb: Function | object = () => null, flagCb: Function = () => null): AddAnswerResult => {
            if (typeof cb === 'object') {
                return addAnswer(ctx)('__capture_only_intended__', cb, flagCb);
            }
            return addAnswer(ctx)('__call_action__', null, cb);
        },
        toJson: toJson(ctx),
    };
};

export { addKeyword };