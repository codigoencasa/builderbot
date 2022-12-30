const mimeDb = require('mime-db');
const { uploadSingleFile } = require('../adapter/gdrive');
const fs = require('fs');

var fileName;

/**
 * Guardamos archivos multimedia que nuestro cliente nos envie!
 * @param {*} media 
 */


const saveMedia = (media) => {
    const extensionProcess = mimeDb[media.mimetype];
    let ext;
    if (!extensionProcess) {
        const fileType = media.mimetype.split('/');
        ext = fileType[1].split(';')[0];
    } else {
        ext = extensionProcess.extensions[0];
    }
    fileName = `${Date.now()}.${ext}`;
    fs.writeFile(`./media/${fileName}`, media.data, { encoding: 'base64' }, function (err) {
        console.log(`** Archivo Media ${fileName} Guardado **`);
    });
    return fileName
}

const saveMediaToGoogleDrive = async (media) => {

     fileName = saveMedia(media);
     filePath = `${__dirname}/../media/${fileName}`

    const googleDriveUrl = await uploadSingleFile(fileName, filePath);
    return googleDriveUrl
}

module.exports = { saveMedia, saveMediaToGoogleDrive }
