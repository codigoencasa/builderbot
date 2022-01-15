const http = require('http'); // or 'https' for https:// URLs
const https = require('https'); // or 'https' for https:// URLs
const fs = require('fs');


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
    const file = fs.createWriteStream(`./mediaSend/${name}`);
    console.log(url)
     handleHttp.get(url, function(response) {
        console.log('aaaa')
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
module.exports = {cleanNumber, saveExternalFile}