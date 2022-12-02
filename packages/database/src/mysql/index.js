require('dotenv').config()
const mysql = require('mysql2')

const DB_NAME = process.env.DB_NAME || 'db_bot'
const DB_HOST = process.env.DB_HOST || 'localhost'
const DB_USER = process.env.DB_USER || 'root'

class MyslAdapter {
    db
    listHistory = []

    constructor() {
        this.init().then()
    }

    async init() {
        this.db = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
        })

        await this.db.connect((error) => {
            if (!error) {
                console.log(`Solicitud de conexión a base de datos exitosa`)
            }

            if (error) {
                console.log(`Solicitud de conexión fallida ${error.stack}`)
            }
        })
    }

    getPrevByNumber = (from) =>
        new Promise((resolve, reject) => {
            const sql = `SELECT * FROM history WHERE phone=${from} ORDER BY id DESC`
            this.db.query(sql, (error, rows) => {
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
        const values = [
            [
                ctx.ref,
                ctx.keyword,
                ctx.answer,
                ctx.refSerialize,
                ctx.from,
                JSON.stringify(ctx.options),
            ],
        ]
        const sql =
            'INSERT INTO history (ref, keyword, answer, refSerialize, phone, options ) values ?'

        this.db.query(sql, [values], (err) => {
            if (err) throw err
            console.log('Guardado en DB...', values)
        })
        this.listHistory.push(ctx)
    }
}

module.exports = MyslAdapter
