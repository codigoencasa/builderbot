'use strict';

var os = require('os');
var path = require('path');

var verifyFile = require('./lib/verify-file');

var platform = os.platform() + '-' + os.arch();

var packageName = '@ffmpeg-installer/' + platform;

if (!require('./package.json').optionalDependencies[packageName]) {
    throw 'Unsupported platform/architecture: ' + platform;
}

var binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

var topLevelPath = path.resolve(__dirname.substr(0, __dirname.indexOf('node_modules')), 'node_modules', '@ffmpeg-installer', platform);
var npm3Path = path.resolve(__dirname, '..', platform);
var npm2Path = path.resolve(__dirname, 'node_modules', '@ffmpeg-installer', platform);

var topLevelBinary = path.join(topLevelPath, binary);
var npm3Binary = path.join(npm3Path, binary);
var npm2Binary = path.join(npm2Path, binary);

var topLevelPackage = path.join(topLevelPath, 'package.json');
var npm3Package = path.join(npm3Path, 'package.json');
var npm2Package = path.join(npm2Path, 'package.json');

var ffmpegPath, packageJson;

if (verifyFile(npm3Binary)) {
    ffmpegPath = npm3Binary;
    packageJson = require(npm3Package);
} else if (verifyFile(npm2Binary)) {
    ffmpegPath = npm2Binary;
    packageJson = require(npm2Package);
} else if (verifyFile(topLevelBinary)) {
    ffmpegPath = topLevelBinary;
    packageJson = require(topLevelPackage);
} else {
    throw 'Could not find ffmpeg executable, tried "' + npm3Binary + '", "' + npm2Binary + '" and "' + topLevelBinary + '"';
}

var version = packageJson.ffmpeg || packageJson.version;
var url = packageJson.homepage;

/**
 * @type {{
 *  path: string;
 *  version: string;
 *  url: string;
 * }}
 */
module.exports = {
    path: ffmpegPath,
    version: version,
    url: url
};
