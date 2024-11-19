import 'dotenv/config'
import { ProviderClass, utils } from '@builderbot/bot'
import { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import { exec } from 'child_process'
import * as fs from 'fs'
import util from 'node:util'
import * as path from 'path'
import readline from 'readline'
import { TelegramClient, Api } from 'telegram'
import { IterDialogsParams } from 'telegram/client/dialogs'
import { EntityLike } from 'telegram/define'
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js'
import { TotalList } from 'telegram/Helpers'
import { StringSession } from 'telegram/sessions/index.js'
import * as tslib from 'tslib'

import { TelegramEvents } from './telegram.events'

const execSync = util.promisify(exec)

type TelegramAccountArgs = GlobalVendorArgs & {
    apiId: number
    apiHash: string
    telegramJwt?: string
}

class TelegramAccountProvider extends ProviderClass<TelegramEvents> {
    globalVendorArgs: TelegramAccountArgs = {
        name: 'telegram-bot',
        port: 3000,
        apiHash: undefined,
        apiId: undefined,
        telegramJwt: undefined,
    }
    client: TelegramClient
    sessionPath = 'tmp/telegram'
    sessionFileName = 'sessionString.txt'
    sessionFilePath = path.join(this.sessionPath, this.sessionFileName)

    constructor(args?: TelegramAccountArgs) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        if (!fs.existsSync(this.sessionPath)) {
            throw new Error(`Session path "${this.sessionPath}" does not exist`)
        }
        if (!this.globalVendorArgs.apiId) {
            throw new Error('Must provide Telegram API ID. Visit: https://my.telegram.org/auth?to=apps')
        }
        if (!this.globalVendorArgs.apiHash) {
            throw new Error('Must provide Telegram API Hash. Visit: https://my.telegram.org/auth?to=apps')
        }

        const stringSession = this._getStringSession()
        this.client = new TelegramClient(stringSession, args.apiId, args.apiHash, {
            connectionRetries: 5,
        })
    }

    private _getStringSession() {
        let stringSessionRaw = this.globalVendorArgs.telegramJwt
        if (!stringSessionRaw && fs.existsSync(this.sessionFilePath)) {
            stringSessionRaw = fs.readFileSync(this.sessionFilePath, 'utf-8')
        }

        return new StringSession(stringSessionRaw)
    }

    async sendMessage<K = any>(
        userId: string,
        message: string,
        // args?: { buttons?: any; mediaURL?: string; schedule?: number }
        args?: SendOptions
    ): Promise<K> {
        console.info('[INFO]: Sending message to', userId)
        // if (userId != "1975336063") return;
        if (args?.buttons?.length) return await this.sendButtons(userId, message, args?.buttons)
        if (args?.mediaURL) return await this.sendMedia(userId, args?.mediaURL, message)
        await this.client.sendMessage(userId, {
            message,
            // schedule: args?.schedule,
        })
    }

    async getUnreadMessages(args?: IterDialogsParams) {
        const mySenderId = (await this.client.getMe()).id.toString()
        const tgMessages: TotalList<Api.Message>[] = []

        for await (const dialog of this.client.iterDialogs(args)) {
            // console.log(dialog.title);
            if (dialog.unreadCount > 0) {
                const messages = await this.client.getMessages(dialog.inputEntity, {
                    limit: dialog.unreadCount,
                })
                if (messages[0].senderId.toString() == mySenderId) continue

                const filteredMessages = messages.filter((msg) => msg.senderId.toString() !== mySenderId).reverse()
                if (!filteredMessages.length) continue

                tgMessages.push(filteredMessages)
            }
        }
        return tgMessages
    }

    async getRespondedConversations(args?: IterDialogsParams) {
        const mySenderId = (await this.client.getMe()).id.toString()
        const conversationsIds: Api.Message[] = []

        for await (const dialog of this.client.iterDialogs(args)) {
            if (dialog.unreadCount == 0) {
                const message = (
                    await this.client.getMessages(dialog.inputEntity, {
                        limit: 1,
                    })
                )[0]
                if (message.senderId.toString() == mySenderId) conversationsIds.push(message)
            }
        }

        return conversationsIds
    }

    async markAsRead(from: EntityLike) {
        await this.client.markAsRead(from)
    }

    async sendButtons<K = any>(chatId: string, text: string, buttons: any[]): Promise<K> {
        return
    }

    async sendMedia<K = any>(chatId: string, mediaURL: any, caption: string): Promise<K> {
        const res = await fetch(mediaURL, { method: 'GET' })
        const buffer = await res.arrayBuffer()
        const mimeType = res.headers.get('content-type')

        const tmpDir = `${process.cwd()}/tmp/media`
        const fileExtension = mimeType.split('/')[1]
        const fileName: string = `${Date.now().toString()}-${chatId}.${fileExtension}`
        let filePath = path.join(tmpDir, fileName)

        fs.writeFileSync(filePath, Buffer.from(buffer))

        const voiceNote = ['mp3', 'wav', 'ogg', 'oga'].includes(fileExtension)
        let videoNote = false
        if (caption == 'video_note' && fileExtension == 'mp4') {
            videoNote = true
            const oldFilePath = filePath
            filePath = path.join(tmpDir, `new_${fileName}`)
            await execSync(`ffmpeg -i ${oldFilePath} -filter:v "crop=384:384" ${filePath}`)
            // if (stderr) console.error(stderr);
            fs.unlinkSync(oldFilePath)
        }
        await this.client.sendFile(chatId, {
            file: filePath,
            voiceNote,
            caption,
            videoNote,
        })

        fs.unlinkSync(filePath)
        return
    }

    protected beforeHttpServerInit(): void {}
    protected afterHttpServerInit(): void {}

    protected busEvents = (): Array<{ event: string; func: Function }> => [
        {
            event: 'message',
            func: (payload: NewMessageEvent & BotContext) => {
                if (payload.message.voice) {
                    payload.body = utils.generateRefProvider('_event_voice_note_')
                } else if (payload.message.media) {
                    payload.body = utils.generateRefProvider('_event_media_')
                    payload.caption = payload.message.message
                }

                this.emit('message', payload)
            },
        },
    ]

    protected async initVendor(): Promise<any> {
        const vendor = new TelegramEvents()
        this.vendor = vendor

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        })

        await this.client.start({
            phoneNumber: async () => new Promise((resolve) => rl.question('Please enter your number: ', resolve)),
            password: async () => new Promise((resolve) => rl.question('Please enter your 2FA code: ', resolve)),
            phoneCode: async () =>
                new Promise((resolve) => rl.question('Please enter the code you received: ', resolve)),
            onError: (err) => console.log(err),
        })

        if (!fs.existsSync(this.sessionFilePath)) {
            const stringSessionRaw = String(this.client.session.save())
            fs.writeFileSync(this.sessionFilePath, stringSessionRaw)
        }
        console.log('You should now be connected.')

        // await this.client.sendMessage("me", { message: `Bot enabled!!!` });
        this.emit('provider_ready')

        this.client.addEventHandler(this.ctrlInMsg, new NewMessage({ incoming: true }))

        return vendor
    }

    protected ctrlInMsg = async (payload: NewMessageEvent) => {
        await this.vendor.eventInMsg(payload)
    }

    async saveFile(ctx: { message: Api.Message; from: EntityLike }, options: { path: string }): Promise<string> {
        try {
            const message = ctx.message
            if (!message.file) return ''

            const mimeType = message.file.mimeType
            const fileExtension = mimeType.substring(mimeType.indexOf('/') + 1)

            const fileName: string = `${Date.now().toString()}-${ctx.from}.${fileExtension}`
            const filePath = path.join(options.path, fileName)
            const buffer = await this.client.downloadMedia(message)
            fs.writeFileSync(filePath, buffer)
            return filePath
        } catch (error) {
            console.error('[saveFile()]', error)
        }
    }
}

export { TelegramAccountProvider }
