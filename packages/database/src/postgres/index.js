const { Pool } = require('pg');

class PostgreSQLAdapter {
    db
    listHistory = []
    credentials = { host: 'localhost', user: 'postgres', database: 'postgres', password: null, port: 5432 }

    constructor(_credentials) {
        this.credentials = _credentials
        this.init().then()
    }

    init = async () => {
        try {
            const pool = new Pool(this.credentials)
            const db = await pool.connect()
            this.db = db
            console.log('🆗 Conexión Correcta DB')
            this.checkTableExistsAndSP()
            return true
        } catch (e) {
            console.log('Error', e)
            return
        }
    }

    getPrevByNumber = async (from) => {
        const query = `SELECT * FROM public.history WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`;
        try {
            const result = await this.db.query(query, [from]);
            const row = result.rows[0]

            if (row) {
                row['refSerialize'] = row.refserialize
                delete row.refserialize
            }
            
            return row;
        } catch (error) {
            console.error('Error al obtener la entrada anterior por número:', error);
            throw error;
        }
    }

    save = async (ctx) => {
        const values = [
            ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options), ctx?.name ?? ''
        ]
        const query = `SELECT save_or_update_history_and_contact($1, $2, $3, $4, $5, $6, $7)`;

        try {
            await this.db.query(query, values);
        } catch (error) {
            console.error('Error al registrar la entrada del historial:', error);
        }
        this.listHistory.push(ctx)
    }

    getContact = async (from) => {
        const query = `SELECT * FROM public.contact WHERE phone = $1 LIMIT 1`;
        try {
            const result = await this.db.query(query, [from]);
            return result.rows[0];
        } catch (error) {
            console.error('Error al obtener contacto por número:', error);
            throw error;
        }
    }

    saveContact = async (ctx) => {
        const values = [ctx?.name ?? '']

        const contact = await this.getContact(ctx.from)

        if (contact) {
            const query = `
                UPDATE contact SET 
                updated_in = current_timestamp,
                last_interaction =  current_timestamp,
                name = $1, 
                WHERE id = ${contact.id}`;
            try {
                await this.db.query(query, values);
            } catch (error) {
                console.error('Error al actualizar contacto:', error);
                throw error;
            }
        } else {
            const query = `INSERT INTO contact (name, phone) VALUES ($1, $2)`;

            try {
                await this.db.query(query, values);
            } catch (error) {
                console.error('Error al registrar la entrada del contacto:', error);
            }
        }

        return await this.getContact(ctx.from)
    }

    checkTableExistsAndSP = async () => {

        const contact = `
            CREATE TABLE IF NOT EXISTS contact (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                phone VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT current_timestamp,
                updated_in TIMESTAMP,
                last_interaction TIMESTAMP
            )`;
        try {
            await this.db.query(contact);
            // console.log('🆗 Tabla contact existe o fue creada con éxito');
        } catch (error) {
            console.error('🚫 Error al crear la tabla acontact:', error);
        }

        const history = `
            CREATE TABLE IF NOT EXISTS history (
                id SERIAL PRIMARY KEY,
                ref VARCHAR(255) NOT NULL,
                keyword VARCHAR(255),
                answer TEXT NOT NULL,
                refSerialize TEXT NOT NULL,
                phone VARCHAR(255) NOT NULL,
                options JSONB,
                created_at TIMESTAMP DEFAULT current_timestamp,
                updated_in TIMESTAMP,
                contact_id INTEGER REFERENCES contact(id)
            )`;
        try {
            await this.db.query(history);
            // console.log('🆗 Tabla history existe o fue creada con éxito');
        } catch (error) {
            console.error('🚫 Error al crear la tabla de history:', error);
        }

        await this.createSP()
    }

    createSP = async() => {
        const sp = `
        CREATE OR REPLACE FUNCTION save_or_update_history_and_contact(
            _ref VARCHAR(255),
            _keyword VARCHAR(255),
            _answer TEXT,
            _refserialize TEXT,
            _phone VARCHAR(255),
            _options JSONB,
            _contact_name VARCHAR(255)
        )
        RETURNS VOID AS
        $$
        DECLARE
            _contact_id INT;
        BEGIN
            SELECT id INTO _contact_id FROM contact WHERE phone = _phone;
        
            IF _contact_id IS NULL THEN
                INSERT INTO contact (name, phone, created_at)
                VALUES (_contact_name, _phone, current_timestamp)
                RETURNING id INTO _contact_id;
            ELSE
                UPDATE contact SET last_interaction = current_timestamp WHERE id = _contact_id;
            END IF;
        
            INSERT INTO history (ref, keyword, answer, refserialize, phone, options, contact_id, created_at)
            VALUES (_ref, _keyword, _answer, _refserialize, _phone, _options, _contact_id, current_timestamp);
        
        END;
        $$ LANGUAGE plpgsql;`;

        try {
            await this.db.query(sp);
            // console.log('🆗 Procedimiento almacenado existe o fue creada con éxito');
        } catch (error) {
            console.error('🚫 Error al crear el procedimiento almacenado:', error);
        }
    }
}

module.exports = PostgreSQLAdapter
