import mysql, { Connection, OkPacket, RowDataPacket } from 'mysql2'

import { HistoryRow, MysqlAdapterCredentials } from './types'

class MysqlAdapter {
    db: Connection
    listHistory = []
    credentials: MysqlAdapterCredentials = { host: null, user: null, database: null, password: null }

    constructor(_credentials: MysqlAdapterCredentials) {
        this.credentials = _credentials
        this.init().then()
    }

    async init(): Promise<void> {
        this.db = mysql.createConnection(this.credentials)

        await this.db.connect(async (error: any) => {
            if (!error) {
                console.log(`Solicitud de conexión a base de datos exitosa`)
                await this.checkTableExists()
            }

            if (error) {
                console.log(`Solicitud de conexión fallida ${error.stack}`)
            }
        })
    }

    getPrevByNumber = async (from: any): Promise<HistoryRow | null> => {
        //    TODO:pendiente valida _closing, lanza error
        // if (this.db._closing) await this.init()
        return await new Promise((resolve, reject) => {
            const sql = `SELECT * FROM history WHERE phone='${from}' ORDER BY id DESC`
            this.db.query<HistoryRow[]>(sql, (error: any, rows: any[]) => {
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
    }

    save = async (ctx: {
        ref: string
        keyword: string
        answer: any
        refSerialize: string
        from: string
        options: any
    }): Promise<void> => {
        const values = [
            [ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options), null],
        ]
        const sql = 'INSERT INTO history (ref, keyword, answer, refSerialize, phone, options, created_at) values ?'

        this.db.query<OkPacket>(sql, [values], (err: any) => {
            if (err) throw err
            console.log('Guardado en DB...', values)
        })
    }

    createTable = (): Promise<boolean> =>
        new Promise((resolve) => {
            const tableName = 'history'

            const sql = `CREATE TABLE ${tableName} 
            (id INT AUTO_INCREMENT PRIMARY KEY, 
            ref varchar(255) NOT NULL,
            keyword varchar(255) NULL,
            answer longtext NOT NULL,
            refSerialize varchar(255) NOT NULL,
            phone varchar(255) NOT NULL,
            options longtext NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) 
            CHARACTER SET utf8mb4 COLLATE utf8mb4_General_ci`

            this.db.query<OkPacket>(sql, (err: any) => {
                if (err) throw err
                console.log(`Tabla ${tableName} creada correctamente `)
                resolve(true)
            })
        })

    checkTableExists = (): Promise<boolean> =>
        new Promise((resolve) => {
            const sql = "SHOW TABLES LIKE 'history'"
            this.db.query<RowDataPacket[]>(sql, (err: any, rows: string | any[]) => {
                if (err) throw err

                if (!rows.length) {
                    this.createTable()
                }

                resolve(!!rows.length)
            })
        })
}

export { MysqlAdapter }
