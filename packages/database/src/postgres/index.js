const { Pool } = require('pg')

class PostgreSQLAdapter {
    db
    listHistory = []
    credentials = { host: 'localhost', user: '', database: '', password: null, port: 5432 }

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
        const query = `SELECT * FROM public.history WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`
        try {
            const result = await this.db.query(query, [from])
            const row = result.rows[0]

            if (row) {
                row['refSerialize'] = row.refserialize
                delete row.refserialize
            }

            return row
        } catch (error) {
            console.error('Error al obtener la entrada anterior por número:', error)
            throw error
        }
    }

    save = async (ctx) => {
        const values = [ctx.ref, ctx.keyword, ctx.answer, ctx.refSerialize, ctx.from, JSON.stringify(ctx.options)]
        const query = `SELECT save_or_update_history_and_contact($1, $2, $3, $4, $5, $6)`

        try {
            await this.db.query(query, values)
            console.log('🆗 Historico creado con exito')
        } catch (error) {
            console.error('Error al registrar la entrada del historial:', error)
        }
        this.listHistory.push(ctx)
    }

    getContact = async (ctx) => {
        const from = ctx.from
        const query = `SELECT * FROM public.contact WHERE phone = $1 LIMIT 1`
        try {
            const result = await this.db.query(query, [from])
            return result.rows[0]
        } catch (error) {
            console.error('Error al obtener contacto por número:', error)
            throw error
        }
    }

    saveContact = async (ctx) => {
        // action: u (Actualiza el valor de ctx.values), a (Agrega). Agrega por defecto.
        const _contact = await this.getContact(ctx)
        let jsValues = {}

        if ((ctx?.action ?? 'a') === 'a') {
            jsValues = { ..._contact.values, ...(ctx?.values ?? {}) }
        } else {
            jsValues = ctx?.values ?? {}
        }

        const values = [ctx.from, JSON.stringify(jsValues)]
        const query = `SELECT save_or_update_contact($1, $2)`

        try {
            await this.db.query(query, values)
            console.log('🆗 Contacto guardado o actualizado con éxito')
        } catch (error) {
            console.error('🚫 Error al guardar o actualizar contacto:', error)
            throw error
        }
    }

    checkTableExistsAndSP = async () => {
        const contact = `
            CREATE TABLE IF NOT EXISTS contact (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT current_timestamp,
                updated_in TIMESTAMP,
                last_interaction TIMESTAMP,
                values JSONB
            )`

        try {
            await this.db.query(contact)
            console.log('🆗 Tabla contact existe o fue creada con éxito')
        } catch (error) {
            console.error('🚫 Error al crear la tabla contact:', error)
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
            )`
        try {
            await this.db.query(history)
            console.log('🆗 Tabla history existe o fue creada con éxito')
        } catch (error) {
            console.error('🚫 Error al crear la tabla de history:', error)
        }

        await this.createSP()
    }

    createSP = async () => {
        const sp_suc = `
        CREATE OR REPLACE FUNCTION save_or_update_contact(
            in_phone VARCHAR(255),
            in_values JSONB
        )
        RETURNS VOID AS
        $$
        DECLARE
            contact_cursor refcursor := 'cur_contact';
            contact_id INT;
        BEGIN
            SELECT id INTO contact_id FROM contact WHERE phone = in_phone;
        
            IF contact_id IS NULL THEN
                INSERT INTO contact (phone, "values")
                VALUES (in_phone, in_values);
            ELSE
                UPDATE contact SET "values" = in_values, updated_in = current_timestamp
                WHERE id = contact_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql;`

        try {
            await this.db.query(sp_suc)
            console.log('🆗 Procedimiento almacenado de contacto existe o fue creada con éxito')
        } catch (error) {
            console.error('🚫 Error al crear el procedimiento almacenado de contacto:', error)
        }

        const sp_suhc = `
        CREATE OR REPLACE FUNCTION save_or_update_history_and_contact(
            in_ref VARCHAR(255),
            in_keyword VARCHAR(255),
            in_answer TEXT,
            in_refserialize TEXT,
            in_phone VARCHAR(255),
            in_options JSONB
        )
        RETURNS VOID AS
        $$
        DECLARE
            _contact_id INT;
        BEGIN
            SELECT id INTO _contact_id FROM contact WHERE phone = in_phone;
        
            IF _contact_id IS NULL THEN
                INSERT INTO contact (phone)
                VALUES (in_phone)
                RETURNING id INTO _contact_id;
            ELSE
                UPDATE contact SET last_interaction = current_timestamp WHERE id = _contact_id;
            END IF;
        
            INSERT INTO history (ref, keyword, answer, refserialize, phone, options, contact_id, created_at)
            VALUES (in_ref, in_keyword, in_answer, in_refserialize, in_phone, in_options, _contact_id, current_timestamp);
        
        END;
        $$ LANGUAGE plpgsql;`

        try {
            await this.db.query(sp_suhc)
            console.log('🆗 Procedimiento almacenado de historico existe o fue creada con éxito')
        } catch (error) {
            console.error('🚫 Error al crear el procedimiento almacenado de historico:', error)
        }
    }
}

module.exports = PostgreSQLAdapter
