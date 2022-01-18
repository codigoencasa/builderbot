
const ExcelJS = require('exceljs');
const moment = require('moment');
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const { cleanNumber } = require('./handle')
const { saveMedia } = require('../controllers/save')
/**
 * Enviamos archivos multimedia a nuestro cliente
 * @param {*} number 
 * @param {*} fileName 
 */

const sendMedia = (client, number, fileName) => {
    const dirMedia = `${__dirname}/../mediaSend/${fileName}`;
    number = cleanNumber(number)
    if(fs.existsSync(dirMedia)){
        const media = MessageMedia.fromFilePath(dirMedia);
        client.sendMessage(number, media);
    }
}

/**
 * Enviamos un mensaje simple (texto) a nuestro cliente
 * @param {*} number 
 */
const sendMessage = async (client, number = null, text = null, trigger = null) => {
    number = cleanNumber(number)
    const message = text
    client.sendMessage(number, message);
    await readChat(number, message, trigger)
    console.log(`⚡⚡⚡ Enviando mensajes....`);
}

/**
 * Opte
 */
const lastTrigger = (number) => new Promise((resolve, reject) => {
    number = cleanNumber(number)
    const pathExcel = `${__dirname}/../chats/${number}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(pathExcel)) {
        workbook.xlsx.readFile(pathExcel)
            .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const lastRow = worksheet.lastRow;
                const getRowPrevStep = worksheet.getRow(lastRow.number);
                const lastStep = getRowPrevStep.getCell('C').value;
                resolve(lastStep)
            });
    } else {
        resolve(null)
    }
})

/**
 * Guardar historial de conversacion
 * @param {*} number 
 * @param {*} message 
 */
const readChat = async (number, message, trigger = null) => {
    const pathExcel = `${__dirname}/../chats/${number}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    const today = moment().format('DD-MM-YYYY hh:mm')

    if (fs.existsSync(pathExcel)) {
        /**
         * Si existe el archivo de conversacion lo actualizamos
         */
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.readFile(pathExcel)
            .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const lastRow = worksheet.lastRow;
                var getRowInsert = worksheet.getRow(++(lastRow.number));
                getRowInsert.getCell('A').value = today;
                getRowInsert.getCell('B').value = message;
                getRowInsert.getCell('C').value = trigger;
                getRowInsert.commit();
                workbook.xlsx.writeFile(pathExcel);
            });

    } else {
        /**
         * NO existe el archivo de conversacion lo creamos
         */
        const worksheet = workbook.addWorksheet('Chats');
        worksheet.columns = [
            { header: 'Fecha', key: 'number_customer' },
            { header: 'Mensajes', key: 'message' },
            { header: 'Disparador', key: 'trigger' }
        ];
        worksheet.addRow([today, message, trigger]);
        workbook.xlsx.writeFile(pathExcel)
            .then(() => {

                console.log("saved");
            })
            .catch((err) => {
                console.log("err", err);
            });
    }
}

module.exports = { sendMessage, sendMedia, lastTrigger }