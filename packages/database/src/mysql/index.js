require('dotenv').config()
const mysql = require('mysql2')

class MyslAdapter {
    db
    listHistory = []
    credentials = { host: null, user: null, database: null }

    constructor(_credentials) {
        this.credentials = _credentials
        this.init().then()
    }

    async init() {
        this.db = mysql.createConnection(this.credentials)

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
