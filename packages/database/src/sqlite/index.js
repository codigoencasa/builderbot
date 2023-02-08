const sqlite3 = require('sqlite3').verbose()
const { join } = require('path')
const fs = require('fs')

class SqliteFileAdapter {
    db
    pathFile
    listHistory = []

    constructor() {
        this.pathFile = join(process.cwd(), 'db/data.db')
        this.init().then()
    }

    async init() {
        // open the database connection
        this.checkDir()

        this.db = new sqlite3.Database(this.pathFile, (err) => {
            if (err) {
                console.error(`There was an error connecting ${err.message}`)
            }
            console.log('Connected to the demo database.')

            // connect to db
            this.createTable()
        })
    }

    checkDir = () =>
        new Promise((resolve) => {
            this.folderName = 'db'
            this.dir = join(process.cwd(), this.folderName)
            if (!fs.existsSync(this.dir)) {
                resolve(fs.mkdirSync(this.folderName))
            }
            return
        })

    getPrevByNumber = (from) =>
        new Promise((resolve, reject) => {
            const sql = `SELECT * FROM history WHERE phone=${from} ORDER BY id DESC`
            this.db.all(sql, (error, rows) => {
                if (error) {
                    reject(error)
                }

                if (rows.length) {
                    const [row] = rows
                    row.options = JSON.parse(row.options)
                    resolve(row)
                }

                if (!rows.length) {
                    resolve(null)
                }
            })
        })

    save = (ctx) => {

        // console.log('ctx ->', ctx);

        const values = [ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options)]

        const sql = `INSERT INTO history (ref, keyword, answer, refSerialize, phone, options ) values (?,?,?,?,?,?)`

        this.db.all(sql, values, (err) => {
            if (err) throw err
            // console.log('Error with the values - >', err)
        })
        this.listHistory.push(ctx)
    }

    createTable = () =>
        new Promise((resolve) => {
            const tableName = 'history'
            const sql = `CREATE TABLE IF NOT EXISTS ${tableName} 
                        (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        ref TEXT,
                        keyword TEXT,
                        answer TEXT,
                        refSerialize TEXT,
                        phone TEXT,
                        options TEXT)
                        `
            this.db.all(sql, (err) => {
                if (err) throw err
                console.log(`Tabla ${tableName} creada correctamente `)
                resolve(true)
            })
        })
}

module.exports = SqliteFileAdapter
