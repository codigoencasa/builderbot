'use strict'

const eslintPluginBotWhatsapp = require('..')
const assert = require('assert').strict

assert.strictEqual(eslintPluginBotWhatsapp(), 'Hello from eslintPluginBotWhatsapp')
console.info('eslintPluginBotWhatsapp tests passed')
