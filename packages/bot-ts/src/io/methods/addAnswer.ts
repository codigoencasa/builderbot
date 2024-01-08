import flatObject from '../../utils/flattener';
import { generateRef } from '../../utils/hash';
import { Callbacks, TCTXoptions, TContext, TFlow } from '../types';
import { addChild } from './addChild';
import { toJson } from './toJson';



const addAnswer = (inCtx: TContext) => (
    answer: string | string[],
    options: TCTXoptions,
    cb: Callbacks | null = null,
    nested: TFlow[] | TFlow = []
) => {
    answer = Array.isArray(answer) ? answer.join('\n') : answer;

    const getAnswerOptions = (): TCTXoptions => ({
        media: typeof options?.media === 'string' ? options.media : undefined,
        buttons: Array.isArray(options?.buttons) ? options.buttons : [],
        capture: typeof options?.capture === 'boolean' ? options.capture : false,
        child: typeof options?.child === 'string' ? options.child : undefined,
        delay: typeof options?.delay === 'number' ? options.delay : 0,
        idle: typeof options?.idle === 'number' ? options.idle : undefined,
        ref: typeof options?.ref === 'string' ? options.ref : undefined,
    });

    const getNested = () => {
        let flatNested: (TFlow | TContext)[] = [];
        if (Array.isArray(nested)) {
            for (const iterator of nested) {
                flatNested = [...flatNested, ...addChild(iterator)];
            }

            return {
                nested: flatNested,
            };
        }
        return {
            nested: addChild(nested as TFlow),
        };
    };

    const getCbFromNested = () => flatObject(Array.isArray(nested) ? nested : [nested]);

    const callback = typeof cb === 'function' ? cb : () => { };

    const lastCtx = ('ctx' in inCtx ? inCtx.ctx : inCtx) as TContext;

    const ctxAnswer = (): TContext => {
        const options = {
            ...getAnswerOptions(),
            ...getNested(),
            keyword: {},
            callback: !!cb,
        };
        const ref = options.ref ?? `ans_${generateRef()}`;

        const json = [].concat(inCtx.json).concat([
            {
                ref,
                keyword: lastCtx.ref,
                answer,
                options,
            },
        ]);

        const callbacks = {
            ...inCtx.callbacks,
            ...getCbFromNested(),
            [ref]: callback,
        };

        return {
            ...lastCtx,
            ref,
            answer,
            json,
            options,
            callbacks,
        };
    };

    const ctx = ctxAnswer();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer(ctx),
        addAction: (cb: CallbackFunction | AnswerOptions = () => { }, flagCb: CallbackFunction = () => { }) => {
            if (typeof cb === 'object') return addAnswer(ctx)('__capture_only_intended__', cb as AnswerOptions, flagCb);
            return addAnswer(ctx)('__call_action__', {}, cb as CallbackFunction);
        },
        toJson: toJson(ctx),
    };
};

export { addAnswer };