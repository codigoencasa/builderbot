import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'

// https://github.com/orkestral/venom/issues/2485
const fixSendFiles = async () => {
    const path = './node_modules/venom-bot/dist/lib/wapi/wapi.js'
    let toFix = readFileSync(path)
    toFix = toFix
        .toString()
        .replace(
            `return await n.processAttachments("0.4.613"===Debug.VERSION?t:t.map((e=>({file:e}))),e,1),n}`,
            `return await n.processAttachments("0.4.613"===Debug.VERSION?t:t.map((e=>({file:e}))),e,e),n}`
        )
    await writeFile(path, toFix)
}

const removeOverLogs = async () => {
    const path = './node_modules/venom-bot/dist/utils/spinnies.js'
    let toFix = readFileSync(path, 'utf8')

    toFix = toFix
        .replace(
            /function\s+getSpinnies\(options\)\s*{[^}]+}/,
            `function getSpinnies_(options) {
        if (!spinnies) {
            spinnies = new spinnies_1.default(options);
        }
        spinnies.fail = () => null;
        spinnies.succeed = () => null;
        spinnies.add = () => null;
    `
        )
        .replace('exports.getSpinnies = getSpinnies;', `exports.getSpinnies = getSpinnies_;`)
    await writeFile(path, toFix)
}

const mainFix = async () => {
    await removeOverLogs()
    await fixSendFiles()
}

mainFix()
