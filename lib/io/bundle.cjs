'use strict';

var require$$0 = require('crypto');

const crypto = require$$0;

const generateRef$3 = () => {
    return crypto.randomUUID()
};

var hash = { generateRef: generateRef$3 };

const { generateRef: generateRef$2 } = hash;

var utils = { generateRef: generateRef$2 };

const toJson$3 = (inCtx) => () => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx;
    return lastCtx.json
};

var toJson_1 = { toJson: toJson$3 };

const { generateRef: generateRef$1 } = utils;
const { toJson: toJson$2 } = toJson_1;
/**
 *
 * @param answer string
 * @param options {media:string, buttons:[], capture:true default false}
 * @returns
 */
const addAnswer$3 = (inCtx) => (answer, options) => {
    const getAnswerOptions = () => ({
        media: typeof options?.media === 'string' ? `${options?.media}` : null,
        buttons: Array.isArray(options?.buttons) ? options.buttons : [],
        capture:
            typeof options?.capture === 'boolean' ? options?.capture : false,
    });

    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx;
    const ctxAnswer = () => {
        const ref = `ans_${generateRef$1()}`;

        const options = {
            ...getAnswerOptions(),
            keyword: {},
        };

        const json = [].concat(inCtx.json).concat([
            {
                ref,
                keyword: lastCtx.ref,
                answer,
                options,
            },
        ]);

        return { ...lastCtx, ref, answer, json, options }
    };

    const ctx = ctxAnswer();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer$3(ctx),
        toJson: toJson$2(ctx),
    }
};

var addAnswer_1 = { addAnswer: addAnswer$3 };

const { generateRef } = utils;
const { addAnswer: addAnswer$2 } = addAnswer_1;
const { toJson: toJson$1 } = toJson_1;
/**
 * addKeyword:
 * Es necesario que genere id|hash
 */

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitive:boolean} default false
 */
const addKeyword$2 = (keyword, options) => {
    /**
     * Esta funcion deberia parsear y validar las opciones
     * del keyword
     * @returns
     */
    const parseOptions = () => {
        const defaultProperties = {
            sensitive:
                typeof options?.sensitive === 'boolean'
                    ? options?.sensitive
                    : false,
        };

        return defaultProperties
    };

    const ctxAddKeyword = () => {
        const ref = `key_${generateRef()}`;
        const options = parseOptions();
        const json = [
            {
                ref,
                keyword,
                options,
            },
        ];
        /**
         * Se guarda en db
         */

        return { ref, keyword, options, json }
    };

    const ctx = ctxAddKeyword();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer$2(ctx),
        toJson: toJson$1(ctx),
    }
};

var addKeyword_1 = { addKeyword: addKeyword$2 };

const { addAnswer: addAnswer$1 } = addAnswer_1;
const { addKeyword: addKeyword$1 } = addKeyword_1;
const { toJson } = toJson_1;

var methods = { addAnswer: addAnswer$1, addKeyword: addKeyword$1, toJson };

const { addKeyword, addAnswer } = methods;
var io = { addKeyword, addAnswer };

module.exports = io;
