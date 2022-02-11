const { getData, getReply } = require('./mysql')
const { getDataIa } = require('./diaglogflow')
const  stepsInitial = require('../flow/initial.json')
const  stepsReponse = require('../flow/response.json')

const get = (message) => new Promise((resolve, reject) => {
    /**
     * Si no estas usando un gesto de base de datos
     */

    if (process.env.DATABASE === 'none') {
        const { key } = stepsInitial.find(k => k.keywords.includes(message)) || { key: null }
        const response = key || null
        resolve(response)
    }
    /**
     * Si usas MYSQL
     */
    if (process.env.DATABASE === 'mysql') {
        getData(message, (dt) => {
            resolve(dt)
        });
    }

})


const reply = (step) => new Promise((resolve, reject) => {
    /**
    * Si no estas usando un gesto de base de datos
    */
    if (process.env.DATABASE === 'none') {
        let resData = { replyMessage: '', media: null, trigger: null }
        const responseFind = stepsReponse[step] || {};
        resData = {
            ...resData, 
            ...responseFind,
            replyMessage:responseFind.replyMessage.join('')}
        resolve(resData);
        return 
    }
    /**
     * Si usas MYSQL
     */
    if (process.env.DATABASE === 'mysql') {
        let resData = { replyMessage: '', media: null, trigger: null }
        getReply(step, (dt) => {
            resData = { ...resData, ...dt }
            resolve(resData)
        });
    }
})

const getIA = (message) => new Promise((resolve, reject) => {
    /**
     * Si usas dialogflow
     */
     if (process.env.DATABASE === 'dialogflow') {
        let resData = { replyMessage: '', media: null, trigger: null }
        getDataIa(message,(dt) => {
            resData = { ...resData, ...dt }
            resolve(resData)
        })
    }
})

module.exports = { get, reply, getIA }