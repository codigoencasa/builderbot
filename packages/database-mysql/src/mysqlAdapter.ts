import { MemoryDB } from '@builderbot/bot'
import type { Connection, OkPacket, RowDataPacket } from 'mysql2'
import mysql from 'mysql2'

import type { HistoryRow, MysqlAdapterCredentials } from './types'

class MysqlAdapter extends MemoryDB {
    db: Connection
    listHistory = []
    credentials: MysqlAdapterCredentials = {
        host: null,
        user: null,
        database: null,
        password: null,
        port: 3306,
    }

    constructor(_credentials: MysqlAdapterCredentials) {
        super()
        this.credentials = _credentials
        this.init().then()
    }

    async init(): Promise<void> {
        this.db = mysql.createConnection(this.credentials)

        this.db.connect(async (error: any) => {
            if (!error) {
                console.log(`Successful database connection request`)
                await this.checkTableExists()
            }

            if (error) {
                console.log(`Failed connection request ${error.stack}`)
            }
        })
    }

    getPrevByNumber = async (from: any): Promise<HistoryRow> => {
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
                    resolve({} as HistoryRow)
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
        const values = [[ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options)]]
        const sql = 'INSERT INTO history (ref, keyword, answer, refSerialize, phone, options) values ?'

        this.db.query<OkPacket>(sql, [values], (err: any) => {
            if (err) throw err
        })
    }

    createTable = (): Promise<boolean> =>
        new Promise((resolve) => {
            const tableName = 'history'

            const sql = `CREATE TABLE ${tableName} 
            (id INT AUTO_INCREMENT PRIMARY KEY, 
            ref varchar(255) DEFAULT NULL,
            keyword varchar(255) NULL,
            answer longtext NULL,
            refSerialize varchar(255) NULL,
            phone varchar(255) NOT NULL,
            options longtext NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) 
            CHARACTER SET utf8mb4 COLLATE utf8mb4_General_ci`

            this.db.query<OkPacket>(sql, (err: any) => {
                if (err) throw err
                console.log(`Table ${tableName} created successfully`)
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
