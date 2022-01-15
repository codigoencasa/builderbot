const {getData} = require('./mysql')

const get = (step) => new Promise((resolve, reject) => {
    if(process.env.DATABASE === 'mysql'){
        getData(step,(dt) => {
            console.log('--->datos--',dt)
            resolve(dt)
        });
    }
})

module.exports = {get}