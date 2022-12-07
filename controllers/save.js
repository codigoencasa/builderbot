const mimeDb = require('mime-db')
const fs = require('fs')

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
    fs.writeFile(`./media/${Date.now()}.${ext}`, media.data, { encoding: 'base64' }, function (err) {
        console.log('** Archivo Media Guardado **');
    });
}

module.exports = {saveMedia}
