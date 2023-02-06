const sqlite3 = require('sqlite3').verbose()
const { join } = require('path')

class SqliteFileAdapter {
    db
    pathFile
    listHistory = []

    constructor() {
        this.pathFile = join(process.cwd(), 'data.db')
        this.init().then()
    }

    async init() {
        // open the database connection
        this.db = new sqlite3.Database(this.pathFile, (err) => {
            if (err) {
                console.error(`There was an error connecting ${err.message}`)
            }
            console.log('Connected to the demo database.')

            // connect to db
            this.createTable()
        })
    }

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
        const values = [ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options)]

        const sql = 'INSERT INTO history (ref, keyword, answer, refSerialize, phone, options ) values ?'

        this.db.all(sql, values, (err) => {
            if (err) throw err
            console.log('Error with the values - >', values)
        })
        this.listHistory.push(ctx)
    }

    createTable = () =>
        new Promise((resolve) => {
            const tableName = 'history'
            const sql = `CREATE TABLE IF NOT EXISTS ${tableName} 
                        (id INT AUTO_INCREMENT PRIMARY KEY, 
                        ref varchar(255) NOT NULL,
                        keyword varchar(255) NOT NULL,
                        answer longtext NOT NULL,
                        refSerialize varchar(255) NOT NULL,
                        phone varchar(255) NOT NULL,
                        options longtext NOT NULL)
                        `
            this.db.all(sql, (err) => {
                if (err) throw err
                console.log(`Tabla ${tableName} creada correctamente `)
                resolve(true)
            })
        })
}

module.exports = SqliteFileAdapter
