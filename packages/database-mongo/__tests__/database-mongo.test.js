'use strict'

const databaseMongo = require('..')
const assert = require('assert').strict

assert.strictEqual(databaseMongo(), 'Hello from databaseMongo')
console.info('databaseMongo tests passed')
