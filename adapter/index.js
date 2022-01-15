const { getData, getReply } = require('./mysql')
const { getDataIa } = require('./diaglogflow')

const get = (message) => new Promise((resolve, reject) => {
    /**
     * Si no estas usando un gesto de base de datos
     */

    if (process.env.DATABASE === 'none') {

        const steps = [
            {
                keywords: ['hola', 'hi', 'buen dia'],
                key: 'STEP_1'
            },
            {
                keywords: ['enviar pdf', 'pdf', 'enviarpdf'],
                key: 'STEP_2'
            }
        ]

        const { key } = steps.find(k => k.keywords.includes(message)) || { key: null }
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

const reply = (step) => new Promise((resolve, reject) => {
    /**
    * Si no estas usando un gesto de base de datos
    */
    if (process.env.DATABASE === 'none') {
        let replyMessage = null;
        let resData = { replyMessage: '', media: null, trigger: null }
        switch (step) {

            case 'STEP_1':
                replyMessage = [
                    '✌️ Bienveido a este CHATBOT lo primero \n',
                    'Decirte que mi nombre es Leifer Mendez  \n\n',
                    '¿Quieres que te envie mi presentación? \n',
                    '*enviar pdf* o *omitir* \n',
                ].join('');
                resData = { replyMessage, media: null }
                resolve(resData);
                return
                break;
            case 'STEP_2':
                replyMessage = [
                    'Yeah! 😎 \n',
                    'enviando...👌'
                ].join('');
                resData = { replyMessage, media: 'meme-1.png', trigger: 'STEP_0' }
                resolve(resData);
                return
                break;
            case 'STEP_0':
                replyMessage = [
                    'El flujo ha finalizado \n',
                    'pero puedes ver todo el codigo de este \n',
                    'repositorio en https://github.com/leifermendez/bot-whatsapp.git'
                ].join('');
                resData = { replyMessage, media: null }
                resolve(resData);
                return
                break;

        }
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

module.exports = { get, reply, getIA }