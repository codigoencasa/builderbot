import { EventEmitterClass, utils } from '@builderbot/bot'
import { ProviderEventTypes } from '@builderbot/bot/dist/types'
import { Api } from 'telegram'
import { NewMessageEvent } from 'telegram/events'

export class TelegramEvents extends EventEmitterClass<ProviderEventTypes> {
    public eventInMsg = async (payload: NewMessageEvent) => {
        const sender = (await payload.message.getSender()) as Api.User
        const firstName = sender.firstName ? sender.firstName : 'noname'
        const username = sender.username ? sender.username : 'unknown'
        const hasFile = payload.message.file ? true : false
        const isVoice = payload.message.voice ? true : false
        const mimeType = hasFile ? payload.message.file.mimeType : null

        const sendObj = {
            ...payload,
            body: payload.message.message,
            caption: payload.message.message,
            from: payload.chatId.toString(),
            name: `${firstName} - @${username}`,
            hasFile,
            isVoice,
            mimeType,
        }

        // if (payload.chatId.toString() == "1975336063")
        this.emit('message', sendObj)
    }
}
