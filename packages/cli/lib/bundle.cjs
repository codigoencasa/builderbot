'use strict';

var require$$0$3 = require('prompts');
var require$$0 = require('kleur');
var require$$0$1 = require('fs');
var require$$1$1 = require('path');
var require$$1 = require('cross-spawn');
var require$$2 = require('detect-package-manager');
var require$$0$2 = require('rimraf');

const { red: red$2 } = require$$0;
const spawn = require$$1;
const { detect } = require$$2;
const PKG_OPTION = {
    npm: 'install',
    yarn: 'add',
    pnpm: 'add',
};

const getPkgManage = async () => {
    const pkg = await detect();
    return pkg
};

const installDeps$1 = (pkgManager, packageList) => {
    const errorMessage = `Ocurrio un error instalando ${packageList}`;
    let childProcess = [];

    const installSingle = (pkgInstall) => () => {
        new Promise((resolve) => {
            try {
                childProcess = spawn(
                    pkgManager,
                    [PKG_OPTION[pkgManager], pkgInstall],
                    {
                        stdio: 'inherit',
                    }
                );

                childProcess.on('error', (e) => {
                    console.error(e);
                    console.error(red$2(errorMessage));
                    resolve();
                });

                childProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        console.error(code);
                        console.error(red$2(errorMessage));
                    }
                });

                resolve();
            } catch (e) {
                console.error(e);
                console.error(red$2(errorMessage));
            }
        });
    };

    if (typeof packageList === 'string') {
        childProcess.push(installSingle(packageList));
    } else {
        for (const pkg of packageList) {
            childProcess.push(installSingle(pkg));
        }
    }

    const runInstall = () => {
        return Promise.all(childProcess.map((i) => i()))
    };
    return { runInstall }
};

var tool = { getPkgManage, installDeps: installDeps$1 };

const { readFileSync, existsSync } = require$$0$1;
const { join: join$2 } = require$$1$1;
const { installDeps } = tool;

const PATHS_DIR = [
    join$2(__dirname, 'pkg-to-update.json'),
    join$2(__dirname, '..', 'pkg-to-update.json'),
];

const PKG_TO_UPDATE = () => {
    const PATH_INDEX = PATHS_DIR.findIndex((a) => existsSync(a));
    const data = readFileSync(PATHS_DIR[PATH_INDEX], 'utf-8');
    const dataParse = JSON.parse(data);
    const pkg = Object.keys(dataParse).map((n) => `${n}@${dataParse[n]}`);
    return pkg
};

const installAll$1 = async () => {
    // const pkg = await getPkgManage()
    installDeps('npm', PKG_TO_UPDATE()).runInstall();
};

var install = { installAll: installAll$1 };

const rimraf = require$$0$2;
const { yellow: yellow$2 } = require$$0;
const { join: join$1 } = require$$1$1;

const PATH_WW = [
    join$1(process.cwd(), '.wwebjs_auth'),
    join$1(process.cwd(), 'session.json'),
];

const cleanSession$1 = () => {
    const queue = [];
    for (const PATH of PATH_WW) {
        console.log(yellow$2(`😬 Eliminando: ${PATH}`));
        queue.push(rimraf(PATH, () => Promise.resolve()));
    }
    return Promise.all(queue)
};

var clean = { cleanSession: cleanSession$1 };

const { red: red$1, yellow: yellow$1, green, bgCyan } = require$$0;

const checkNodeVersion$1 = () => {
    console.log(bgCyan('🚀 Revisando tu Node.js'));
    const version = process.version;
    const majorVersion = parseInt(version.replace('v', '').split('.').shift());
    if (majorVersion < 16) {
        console.error(
            red$1(
                `🔴 Se require Node.js 16 o superior. Actualmente esta ejecutando Node.js ${version}`
            )
        );
        process.exit(1);
    }
    console.log(green(`Node.js combatible ${version}`));
    console.log(``);
};

const checkOs$1 = () => {
    console.log(bgCyan('🙂 Revisando tu Sistema Operativo'));
    const os = process.platform;
    if (!os.includes('win32')) {
        const messages = [
            `El sistema operativo actual (${os}) posiblemente requiera`,
            `una confiuración adicional referente al puppeter`,
            ``,
            `Recuerda pasar por el WIKI`,
            `🔗 https://github.com/leifermendez/bot-whatsapp/wiki/Instalaci%C3%B3n`,
            ``,
        ];

        console.log(yellow$1(messages.join(' \n')));
    }

    console.log(``);
};

var check = { checkNodeVersion: checkNodeVersion$1, checkOs: checkOs$1 };

const { writeFile } = require$$0$1.promises;
const { join } = require$$1$1;

/**
 * JSON_TEMPLATE = {[key:string]{...pros}}
 */
const JSON_TEMPLATE = {
    provider: {
        vendor: '',
    },
    database: {
        host: '',
        password: '',
        port: '',
        username: '',
        db: '',
    },
    io: {
        vendor: '',
    },
};

const PATH_CONFIG = join(process.cwd(), 'config.json');

const jsonConfig$1 = () => {
    return writeFile(
        PATH_CONFIG,
        JSON.stringify(JSON_TEMPLATE, null, 2),
        'utf-8'
    )
};

var configuration = { jsonConfig: jsonConfig$1 };

const prompts = require$$0$3;
const { yellow, red } = require$$0;
const { installAll } = install;
const { cleanSession } = clean;
const { checkNodeVersion, checkOs } = check;
const { jsonConfig } = configuration;

const startInteractive$1 = async () => {
    const questions = [
        {
            type: 'text',
            name: 'dependencies',
            message:
                'Quieres actualizar las librerias "whatsapp-web.js"? (Y/n)',
        },
        {
            type: 'text',
            name: 'cleanTmp',
            message: 'Quieres limpiar la session del bot? (Y/n)',
        },
        {
            type: 'multiselect',
            name: 'providerWs',
            message: 'Proveedor de Whatsapp',
            choices: [
                { title: 'whatsapp-web.js', value: 'whatsapp-web.js' },
                { title: 'API Oficial (Meta)', value: 'meta', disabled: true },
                { title: 'Twilio', value: 'twilio', disabled: true },
            ],
            max: 1,
            hint: 'Espacio para selecionar',
            instructions: '↑/↓',
        },
        {
            type: 'multiselect',
            name: 'providerDb',
            message: 'Cual base de datos quieres usar',
            choices: [
                { title: 'JSONFile', value: 'json' },
                { title: 'MySQL', value: 'mysql', disabled: true },
                { title: 'Mongo', value: 'mongo', disabled: true },
            ],
            max: 1,
            hint: 'Espacio para selecionar',
            instructions: '↑/↓',
        },
    ];

    console.clear();
    checkNodeVersion();
    checkOs();
    const onCancel = () => {
        console.log('Proceso cancelado!');
        return true
    };
    const response = await prompts(questions, { onCancel });
    const {
        dependencies = '',
        cleanTmp = '',
        providerDb = [],
        providerWs = [],
    } = response;
    /**
     * Question #1
     * @returns
     */
    const installOrUdpateDep = async () => {
        const answer = dependencies.toLowerCase() || 'n';
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await installAll();
            return true
        }
    };

    /**
     * Question #2
     * @returns
     */
    const cleanAllSession = async () => {
        const answer = cleanTmp.toLowerCase() || 'n';
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await cleanSession();
            return true
        }
    };

    const vendorProvider = async () => {
        if (!providerWs.length) {
            console.log(
                red(
                    `Debes de seleccionar una WS Provider. Tecla [Space] para seleccionar`
                )
            );
            process.exit(1);
        }
        console.log(yellow(`'Deberia crer una carpeta en root/provider'`));
        return true
    };

    const dbProvider = async () => {
        const answer = providerDb;
        if (!providerDb.length) {
            console.log(
                red(
                    `Debes de seleccionar una DB Provider. Tecla [Space] para seleccionar`
                )
            );
            process.exit(1);
        }
        if (answer === 'json') {
            console.log('Deberia crer una carpeta en root/data');
            return 1
        }
    };

    await installOrUdpateDep();
    await cleanAllSession();
    await vendorProvider();
    await dbProvider();
    await jsonConfig();
};

var interactive = { startInteractive: startInteractive$1 };

const { startInteractive } = interactive;
if (process.env.NODE_ENV === 'dev') startInteractive();
var cli = { startInteractive };

module.exports = cli;
