'use strict';

var require$$0 = require('crypto');

const crypto = require$$0;

const generateRef$3 = () => {
    return crypto.randomUUID()
};

var hash = { generateRef: generateRef$3 };

const { generateRef: generateRef$2 } = hash;

var utils = { generateRef: generateRef$2 };

const { generateRef: generateRef$1 } = utils;

const addAnswer$3 = (inCtx) => (message, options) => {
    const lastCtx = inCtx.hasOwnProperty('ctx') ? inCtx.ctx : inCtx;
    const ctxAnswer = () => {
        const ref = generateRef$1();
        /**
         * Se guarda en db
         */

        return { ...lastCtx, ref, message }
    };

    const ctx = ctxAnswer();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer$3(ctx),
    }
};

var addAnswer_1 = { addAnswer: addAnswer$3 };

const { generateRef } = utils;
const { addAnswer: addAnswer$2 } = addAnswer_1;
/**
 * addKeyword:
 * Es necesario que genere id|hash
 */

/**
 *
 * @param {*} message `string | string[]`
 * @param {*} options {sensitivy:boolean} defaulta false
 */
const addKeyword$2 = (message, options) => {
    const ctxAddKeyword = () => {
        const ref = generateRef();
        /**
         * Se guarda en db
         */

        return { ref, keyword: message }
    };

    const ctx = ctxAddKeyword();

    return {
        ctx,
        ref: ctx.ref,
        addAnswer: addAnswer$2(ctx),
    }
};

var addKeyword_1 = { addKeyword: addKeyword$2 };

const { addAnswer: addAnswer$1 } = addAnswer_1;
const { addKeyword: addKeyword$1 } = addKeyword_1;

var methods = { addAnswer: addAnswer$1, addKeyword: addKeyword$1 };

const { addKeyword, addAnswer } = methods;
var io = { addKeyword, addAnswer };

module.exports = io;
