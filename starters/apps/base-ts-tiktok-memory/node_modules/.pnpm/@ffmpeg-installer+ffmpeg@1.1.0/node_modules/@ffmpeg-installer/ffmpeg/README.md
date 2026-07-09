# node-ffmpeg-installer

Platform independent binary installer of [FFmpeg](https://ffmpeg.org/) for node projects. Useful for tools that should "just work" on multiple environments.

Installs a binary of `ffmpeg` for the current platform and provides a path and version. Supports Linux, Windows and Mac OS/X.

A combination of package.json fields `optionalDependencies`, `cpu`, and `os` let's the installer only download the binary for the current platform. See also "Warnings during install", below.

## Install

    npm install --save @ffmpeg-installer/ffmpeg

## Usage examples

```javascript
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
console.log(ffmpeg.path, ffmpeg.version);
```

### [process.spawn()](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options)

```javascript
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const spawn = require('child_process').spawn;
const ffmpeg = spawn(ffmpegPath, args);
ffmpeg.on('exit', onExit);
```

### [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)

```javascript
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
```

## Known issues

### Warnings during install

To automatically choose the binary to install, [optionalDependencies](https://docs.npmjs.com/files/package.json#optionaldependencies) are used. This currently outputs warnings in the console, an issue that is [tracked by the npm team here](https://github.com/npm/npm/issues/9567).

### AWS and/or Elastic Beanstalk

If you get permissions issues, try adding a .npmrc file with the following:

    unsafe-perm=true

See [issue #21](https://github.com/kribblo/node-ffmpeg-installer/issues/21)

### Wrong path under Electron with Asar enabled

It's a [known issue](https://github.com/electron-userland/electron-packager/issues/740) that Asar breaks native paths. As a workaround, if you use Asar, you can do something like this:

```javascript
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
```

### Compiling ffmpeg for platforms other than your own

If you need to install a version of `ffmpeg` that differs than your current platform (e.g. compiling a Linux version to upload to AWS Lambda from MacOS), you can use `npm install @ffmpeg-installer/linux-x64 --force` (substituting `linux-x64` with whatever platform you need). Note that if you are compressing your project into a `.zip` for Lambda, you will need to exclude the other platforms' builds from your archive.

## The binaries

Downloaded from the sources listed at [ffmpeg.org](https://ffmpeg.org/download.html):

* Linux 32-bit: (20181210-g0e8eb07980): https://www.johnvansickle.com/ffmpeg/
* Linux 64-bit: (20181210-g0e8eb07980): https://www.johnvansickle.com/ffmpeg/
* Mac OS/X (92718-g092cb17983): https://www.osxexperts.net/
* Mac OS/X (92718-g092cb17983): https://evermeet.cx/ffmpeg/
* Windows 32-bit (20181217-f22fcd4): https://ffmpeg.zeranoe.com/builds/win32/static/
* Windows 64-bit (20181217-f22fcd4): https://ffmpeg.zeranoe.com/builds/win64/static/

For version updates, submit issue or pull request.

## Upload new versions

In every updated `platforms/*` directory:
 
    npm run upload
    
## See also

* [node-ffprobe-installer](https://www.npmjs.com/package/@ffprobe-installer/ffprobe) - fork of this project that does the same thing for FFprobe
