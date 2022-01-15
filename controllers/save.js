const mimeDb = require('mime-db')

/**
 * Guardamos archivos multimedia que nuestro cliente nos envie!
 * @param {*} media 
 */


const saveMedia = () => {
    const extensionProcess = mimeDb[media.mimetype]
    const ext = extensionProcess.extensions[0]
    fs.writeFile(`../media/${media.filename}.${ext}`, media.data, { encoding: 'base64' }, function (err) {
        console.log('** Archivo Media Guardado **');
    });
}

module.exports = {saveMedia}