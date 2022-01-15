const {connection} = require('../config/mysql')

const getData = (option_key = '', callback) => connection.query(`SELECT * FROM db_test.keywords WHERE option_key = '${option_key}'  LIMIT 1`,(error, results, fields) => {
    const [response] = results
    let parseResponse = response?.value || '';
    parseResponse = parseResponse.split(',') || []
    callback(parseResponse)
});
module.exports = {getData}