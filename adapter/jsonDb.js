const Path = require('path')
const StormDB = require("stormdb");
const date = new Date().toISOString();
const saveMessageJson = (message, trigger, number) => new Promise( async(resolve,reject) =>{
    try {
        const engine = new StormDB.localFileEngine( Path.join(__dirname, `/../chats/${number}.json`) );
        const db = new StormDB(engine);
        // set default db value if db is empty
        db.default({ messages: [] });
        // add new users entry
        db.get("messages").push({ message, date, trigger });
        db.save();
        resolve('Saved')
    } catch (error) {
        console.log(error)
        reject(error)
    }
})

module.exports = { saveMessageJson }