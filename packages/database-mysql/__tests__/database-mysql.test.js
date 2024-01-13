'use strict'

const databaseMysql = require('..')
const assert = require('assert').strict

assert.strictEqual(databaseMysql(), 'Hello from databaseMysql')
console.info('databaseMysql tests passed')
