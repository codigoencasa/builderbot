import { generateRef } from '../../utils/hash';
import { addAnswer } from './addAnswer';
import { toJson } from './toJson';
import { ActionPropertiesKeyword, CallbackFunction, TContext, TFlow } from '../../types';

const addKeyword = (keyword: string | string[], options?: ActionPropertiesKeyword): TFlow => {
    if (typeof keyword !== 'string' && !Array.isArray(keyword)) {
        throw new Error('DEBE_SER_STRING_ARRAY_REGEX');
    }

    const parseOptions = (): ActionPropertiesKeyword => {
        const defaultProperties = {
            sensitive: typeof options?.sensitive === 'boolean' ? !!options?.sensitive : false,
            regex: typeof options?.regex === 'boolean' ? !!options?.regex : false,
        };
        return defaultProperties;
    };

    const ctxAddKeyword = (): TContext => {
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
        addAction: (cb: CallbackFunction = () => null, flagCb: CallbackFunction = () => null) => {
            if (typeof cb === 'object') {
                return addAnswer(ctx)('__capture_only_intended__', cb, flagCb);
            }
            return addAnswer(ctx)('__call_action__', null, cb);
        },
        toJson: toJson(ctx),
    };
};

export { addKeyword };