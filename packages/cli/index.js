const { startInteractive } = require('./interactive')
if (process.env.NODE_ENV === 'dev') startInteractive()
module.exports = { startInteractive }
