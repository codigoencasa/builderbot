const {connection} = require('../config/mysql')

getData = (message = '', callback) => connection.query(
    `SELECT * FROM db_test.keywords WHERE value LIKE '%${message}%'  LIMIT 1`,
    (error, results
        ) => {
    const [response] = results
    const key = response?.option_key || null
    callback(key)
});


getReply = (option_key = '', callback) => connection.query(
    `SELECT * FROM db_test.replies WHERE option_key = '${option_key}'  LIMIT 1`,
    (error, results
        ) => {
    const [response] = results
    const value = {
        replyMessage:response?.value || '',
        trigger:response?.trigger || '',
        media:response?.media || ''
    }
    callback(value)
});

module.exports = {getData, getReply}