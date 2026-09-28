import { ProviderClass, utils } from '@builderbot/bot'
import { BotContext, GlobalVendorArgs, SendOptions } from '@builderbot/bot/dist/types'
import fs from 'fs'
import path, { join } from 'path'
import { TelegramClient, Api } from 'telegram'
import { IterDialogsParams } from 'telegram/client/dialogs'
import { EntityLike } from 'telegram/define'
import { NewMessage, NewMessageEvent } from 'telegram/events/index.js'
import { TotalList } from 'telegram/Helpers'
import { StringSession } from 'telegram/sessions/index.js'

import { TelegramEvents } from './telegram.events'

export type TelegramProviderConfig = GlobalVendorArgs & {
    apiId: number
    apiHash: string
    getCode: () => Promise<string>
    apiNumber?: string
    apiPassword?: string
    apiCode?: string
    telegramJwt?: string
}

class TelegramProvider extends ProviderClass<TelegramEvents> {
    globalVendorArgs: TelegramProviderConfig = {
        name: 'telegram-bot',
        port: 3000,
        apiHash: undefined,
        apiId: undefined,
        getCode: undefined,
        telegramJwt: undefined,
    }
    client: TelegramClient
    sessionPath = join(process.cwd(), `${this.globalVendorArgs.name}_sessions`)
    sessionFileName = 'session.txt'
    sessionFilePath = join(this.sessionPath, this.sessionFileName)

    constructor(args?: TelegramProviderConfig) {
        super()
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args }
        if (!fs.existsSync(this.sessionPath)) {
            fs.mkdirSync(this.sessionPath, { recursive: true })
        }
        if (!this.globalVendorArgs.apiId) {
            throw new Error('Must provide Telegram API ID. Visit: https://my.telegram.org/auth?to=apps')
        }
        if (!this.globalVendorArgs.apiHash) {
            throw new Error('Must provide Telegram API Hash. Visit: https://my.telegram.org/auth?to=apps')
        }

        const stringSession = this._getStringSession()
        this.client = new TelegramClient(stringSession, +args.apiId, args.apiHash, {
            connectionRetries: 5,
            useWSS: true,
            deviceModel: 'BuilderBot Server',
            systemVersion: 'Node.js',
            appVersion: '1.0.0',
        })
    }

    private _getStringSession() {
        let stringSessionRaw = this.globalVendorArgs.telegramJwt
        if (!stringSessionRaw && fs.existsSync(this.sessionFilePath)) {
            stringSessionRaw = fs.readFileSync(this.sessionFilePath, 'utf-8')
        }

        return new StringSession(stringSessionRaw)
    }

    async sendMessage<K = any>(userId: string, message: string, args?: SendOptions): Promise<K> {
        console.info('[INFO]: Sending message to', userId)
        // if (userId != "1975336063") return;
        if (args?.buttons?.length) return await this.sendButtons(userId, message, args?.buttons)
        if (args?.mediaURL) return await this.sendMedia(userId, args?.mediaURL, message)
        return (await this.client.sendMessage(userId, {
            message,
            // schedule: args?.schedule,
        })) as unknown as K
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
                if (!messages.length) continue
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

    /**
     * Send a presence indicator to a chat
     * @param chatId - The chat/user ID to send the indicator to
     * @param action - 'typing' to show typing indicator, 'recording' to show recording indicator, 'cancel' to hide it (default: 'typing')
     * @example
     * // Show typing indicator
     * await provider.sendPresenceUpdate('user123')
     *
     * // Show recording indicator
     * await provider.sendPresenceUpdate('user123', 'recording')
     *
     * // Hide indicator
     * await provider.sendPresenceUpdate('user123', 'cancel')
     */
    async sendPresenceUpdate(chatId: EntityLike, action: 'typing' | 'recording' | 'cancel' = 'typing'): Promise<void> {
        let typingAction: Api.TypeSendMessageAction
        if (action === 'recording') {
            typingAction = new Api.SendMessageRecordAudioAction()
        } else if (action === 'cancel') {
            typingAction = new Api.SendMessageCancelAction()
        } else {
            typingAction = new Api.SendMessageTypingAction()
        }
        await this.client.invoke(
            new Api.messages.SetTyping({
                peer: chatId,
                action: typingAction,
            })
        )
    }

    async sendButtons<K = any>(chatId: string, text: string, buttons: any[]): Promise<K> {
        return
    }

    async sendMedia<K = any>(chatId: string, mediaURL: any, caption: string): Promise<K> {
        const res = await fetch(mediaURL, { method: 'GET' })
        const buffer = await res.arrayBuffer()
        const mimeType = res.headers.get('content-type')
        if (!mimeType) {
            throw new Error(`[sendMedia] Unable to determine content-type for URL: ${mediaURL}`)
        }

        const tmpDir = join(process.cwd(), 'tmp', 'media')
        fs.mkdirSync(tmpDir, { recursive: true })
        const fileExtension = mimeType.split('/')[1]
        const fileName: string = `${Date.now().toString()}-${chatId}.${fileExtension}`
        const filePath = path.join(tmpDir, fileName)

        fs.writeFileSync(filePath, Buffer.from(buffer))

        const voiceNote = ['mp3', 'wav', 'ogg', 'oga'].includes(fileExtension)
        let videoNote = false
        if (caption == 'video_note' && fileExtension == 'mp4') {
            videoNote = true
            // Note: ffmpeg crop transformation not available; send original file as-is
        }

        try {
            await this.client.sendFile(chatId, {
                file: filePath,
                voiceNote,
                caption,
                videoNote,
            })
        } finally {
            fs.unlinkSync(filePath)
        }
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

        await this.client.start({
            phoneNumber: async () => this.globalVendorArgs.apiNumber,
            phoneCode: async () => {
                return await this.globalVendorArgs.getCode()
            },
            password: async () => this.globalVendorArgs.apiPassword || '',
            onError: (err) => console.log(err),
        })

        if (!fs.existsSync(this.sessionFilePath)) {
            const stringSessionRaw = String(this.client.session.save())
            fs.writeFileSync(this.sessionFilePath, stringSessionRaw)
        }

        this.emit('ready')

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
            const filePath = join(options.path, fileName)
            const buffer = await this.client.downloadMedia(message)
            fs.writeFileSync(filePath, buffer)
            return filePath
        } catch (error) {
            console.error('[saveFile()]', error)
            return ''
        }
    }
}

export { TelegramProvider }
