/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton } = require('./controllers/send')

const app = express();
app.use(express.json())
app.use('/',require('./routes/web'))

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';
var client;
var sessionData;

/**
 * Escuchamos cuando entre un mensaje
 */
const listenMessage = () => client.on('message', async msg => {
    const { from, body, hasMedia } = msg;
    // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
    if(from === 'status@broadcast'){
        return 
    }
    message = body.toLowerCase();
    /**
     * Guardamos el archivo multimedia que envia
     */
    if (process.env.SAVE_MEDIA && hasMedia) {
        const media = await msg.downloadMedia();
        saveMedia(media);
    }

    /**
     * Si estas usando dialogflow solo manejamos una funcion todo es IA
     */

    if (process.env.DATABASE === 'dialogflow') {
        const response = await bothResponse(message);
        await sendMessage(client, from, response.replyMessage);
        if(response.media){
            sendMedia(client, from, response.media);
        }
        return
    }

    /**
    * Ver si viene de un paso anterior
    * Aqui podemos ir agregando más pasos
    * a tu gusto!
    */

    const lastStep = await lastTrigger(from) || null;
    console.log({lastStep})
    if (lastStep) {
        const response = await responseMessages(lastStep)
        await sendMessage(client, from, response.replyMessage);
    }

    /**
     * Respondemos al primero paso si encuentra palabras clave
     */
    const step = await getMessages(message);
    console.log({step})
    if (step) {
        const response = await responseMessages(step)
        await sendMessage(client, from, response.replyMessage, response.trigger);
        // await sendMessageButton(client, from);
        
        if(!response.delay && response.media){
            sendMedia(client, from, response.media);
        }
        if(response.delay && response.media){
            setTimeout(() => {
                sendMedia(client, from, response.media);
            },response.delay)
        }
        return
    }

    if(process.env.DEFAULT_MESSAGE === 'true'){
        console.log('hehehe',(process.env.DEFAULT_MESSAGE) , step)
        const response = await responseMessages('DEFAULT')
        await sendMessage(client, from, response.replyMessage, response.trigger);
        return
    }
});

/**
 * Revisamos si tenemos credenciales guardadas para inciar sessio
 * este paso evita volver a escanear el QRCODE
 */
const withSession = () => {
    // Si exsite cargamos el archivo con las credenciales
    console.log(`Validando session con Whatsapp...`)
    sessionData = require(SESSION_FILE_PATH);
    client = new Client({
        session: sessionData,
        puppeteer: {
            args: [
                '--no-sandbox'
            ],
        }
    });
    
    client.on('ready', () => {
        connectionReady()
        listenMessage()
        loadRoutes(client);
    });

    client.on('auth_failure', () => connectionLost())

    client.initialize();
}

/**
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {
    console.log('No tenemos session guardada');

    client = new Client({
        puppeteer: {
            args: [
                '--no-sandbox'
            ],
        }
    });

    client.on('qr', qr => generateImage(qr, () => {
        qrcode.generate(qr, { small: true });
        console.log(`Ver QR http://localhost:${port}/qr`)
    }))
    
    client.on('ready', () => {
        connectionReady()
        listenMessage()
        loadRoutes(client);
    });

    client.on('auth_failure', () => connectionLost());

    client.on('authenticated', (session) => {
        sessionData = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.log(`Ocurrio un error con el archivo: `, err);
            }
        });
    });

    client.initialize();
}

/**
 * Cargamos rutas de express
 */

 const loadRoutes = (client) => {
    app.use('/api/', middlewareClient(client), require('./routes/api'))
}
/**
 * Revisamos si existe archivo con credenciales!
 */
(fs.existsSync(SESSION_FILE_PATH)) ? withSession() : withOutSession();

/**
 * Verificamos si tienes un gesto de db
 */

if(process.env.DATABASE === 'mysql'){
    mysqlConnection.connect()
}

app.listen(port, () => {
    console.log(`El server esta listo por el puerto ${port}`);
})