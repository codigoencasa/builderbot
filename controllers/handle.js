const http = require('http'); // or 'https' for https:// URLs
const https = require('https'); // or 'https' for https:// URLs
const fs = require('fs');
const qr = require('qr-image')


const cleanNumber = (number) => {
    number = number.replace('@c.us', '');
    number = `${number}@c.us`;
    return number
}

const saveExternalFile = (url) => new Promise((resolve, reject) => {
    const ext = url.split('.').pop()
    const checkProtocol = url.split('/').includes('https:');
    const handleHttp = checkProtocol ? https : http;
    const name = `${Date.now()}.${ext}`;
    const file = fs.createWriteStream(`${__dirname}/../mediaSend/${name}`);
    console.log(url)
     handleHttp.get(url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close();  // close() is async, call cb after close completes.
            resolve(name)
        });
        file.on('error', function() {
            console.log('errro')
            file.close();  // close() is async, call cb after close completes.
            resolve(null)
        });
    });
})

const generateImage = (base64, cb = () => {}) => {
    let qr_svg = qr.image(base64, { type: 'svg', margin: 4 });
    qr_svg.pipe(require('fs').createWriteStream('./mediaSend/qr-code.svg'));
    console.log(`⚡ Recuerda que el QR se actualiza cada minuto ⚡'`);
    console.log(`⚡ Actualiza F5 el navegador para mantener el mejor QR⚡`);
    cb()
}

module.exports = {cleanNumber, saveExternalFile, generateImage}