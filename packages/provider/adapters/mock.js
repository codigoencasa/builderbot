const { EventEmitter } = require('node:events')

class MockProvider extends EventEmitter {}

module.exports = MockProvider
