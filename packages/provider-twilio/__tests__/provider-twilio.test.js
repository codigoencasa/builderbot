'use strict'

const providerTwilio = require('..')
const assert = require('assert').strict

assert.strictEqual(providerTwilio(), 'Hello from providerTwilio')
console.info('providerTwilio tests passed')
