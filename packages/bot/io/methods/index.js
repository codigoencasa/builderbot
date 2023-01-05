const { addAnswer } = require('./addAnswer')
const { addKeyword } = require('./addKeyword')
const { addChild } = require('./addChild')
const { toSerialize } = require('./toSerialize')
const { toCtx } = require('./toCtx')
const { toJson } = require('./toJson')

module.exports = { addAnswer, addKeyword, addChild, toCtx, toJson, toSerialize }
