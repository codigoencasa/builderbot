import { readFileSync, writeFileSync } from 'fs'

// https://github.com/orkestral/venom/issues/2485
const fixSendFiles = () => {
    const path = './node_modules/venom-bot/dist/lib/wapi/wapi.js'
    let toFix: any = readFileSync(path)
    toFix = toFix
        .toString()
        .replace(
            `return await n.processAttachments("0.4.613"===Debug.VERSION?t:t.map((e=>({file:e}))),e,1),n}`,
            `return await n.processAttachments("0.4.613"===Debug.VERSION?t:t.map((e=>({file:e}))),e,e),n}`
        )
    writeFileSync(path, toFix)
}

const removeOverLogs = () => {
    const path = './node_modules/venom-bot/dist/utils/spinnies.js'
    let toFix: any = readFileSync(path)
    toFix = toFix.toString().replace(
        `function getSpinnies(options) {
            if (!spinnies) {
                spinnies = new spinnies_1.default(options);
            }
            return spinnies;
        }`,
        `function getSpinnies(options) {
            if (!spinnies) {
                spinnies = new spinnies_1.default(options);
            }
            spinnies.fail = () => null
            spinnies.succeed = () => null
            spinnies.add = () => null
            return spinnies;
        }`
    )
    writeFileSync(path, toFix)
}

removeOverLogs()
fixSendFiles()
