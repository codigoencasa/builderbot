'use strict'

const providerWebWhatsapp = require('..')
const assert = require('assert').strict

assert.strictEqual(providerWebWhatsapp(), 'Hello from providerWebWhatsapp')
console.info('providerWebWhatsapp tests passed')
