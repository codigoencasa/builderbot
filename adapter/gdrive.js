require('dotenv').config({ path: `${__dirname}/../.env` });
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
//const clientEmail = require(`${__dirname}/../chatbot-account.json`);

/**
 * La funcion 'generatePublicUrl' genera un error muy menor al enviar el 'requestBody'
 * siempre y cuando necesites que el acceso sea restringido y solo ciertos usuarios puedan acceder.
 * Esto se logra con la combinacion requerida: 'reader', 'user' y 'emailAddress':
 * requestBody: {
 *   role: 'reader',
 *   type: 'user',
 *   emailAddress: usuario@gmail.com,
 * },
 * Segun la documentacion https://developers.google.com/drive/api/v3/reference/permissions/create#request-body, 
 * los datos se envian correctamente, pero la respuesta del API regresa este error:
 * Bad Request. User message: "You cannot share this item because it has been flagged as inappropriate."
 * Al parecer, es un error conocido en stackoverflow.com entre varios usuarios del API.
 */

if (process.env.DATABASE === 'dialogflow') {

  /**
   * Debes de tener tu archivo con el nombre "chatbot-account.json" en la raíz del proyecto
   */

  const KEYFILEPATH = path.join(`${__dirname}/../chatbot-account.json`);
  const SCOPES = ['https://www.googleapis.com/auth/drive'];

  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
  });

  const drive = google.drive({
    version: 'v3',
    auth,
  });

  const uploadSingleFile = async (fileName, filePath) => {
    const folderId = process.env.GDRIVE_FOLDER_ID;
    const { data: { id, name } = {} } = await drive.files.create({
      resource: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'image/jpg',
        body: fs.createReadStream(filePath),
      },
      fields: 'id,name',
    });
    generatePublicUrl(id).then(() => {
      console.log(`Se generó enlace https://drive.google.com/open?id=${id} para el archivo ${name}`);
    });
    return `https://drive.google.com/open?id=${id}`
  };

  const scanFolderForFiles = async (folderPath) => {
    const folder = await fs.promises.opendir(folderPath);
    for await (const dirent of folder) {
      if (dirent.isFile() && dirent.name.endsWith('.jpeg')) {
        await uploadSingleFile(dirent.name, path.join(folderPath, dirent.name));
        await fs.promises.rm(filePath);
      }
    }
  };

  async function generatePublicUrl(id) {
    try {
      const fileId = id;
      await drive.permissions.create({
        fileId: fileId,
        supportsAllDrives: true,
        requestBody: {
          role: 'reader',
          type: 'domain', // 'anyone' da acceso al publico vía enlace https://drive.google.com...
          domain: 'gserviceaccount.com', // Si tu cuenta esta bajo un dominio (usuario@empresa.com) y no bajo gmail.com
          allowFileDiscovery: false,
        },
      });

      /* 
      webViewLink: Ver el archivo en el navegador
      webContentLink: Enlace de descarga directa 
      */
      const result = await drive.files.get({
        fileId: fileId,
        fields: 'webViewLink, webContentLink',
      });
      console.log(result.data);
    } catch (error) {
      //console.log(error.message); // Imprime 'Internal Error', pero aún así genera el enlace
      console.error = () => { }; // No muestra el error anterior
    }
  }

  module.exports = { uploadSingleFile, scanFolderForFiles }

} else {
  console.log(`Actualmente, la base de datos es:\n\t'DATABASE=${process.env.DATABASE}'\nPara usar Google Drive, cambiar a:\n\t'DATABASE=dialogflow'`);
}
