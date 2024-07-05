// eslint-disable @typescript-eslint/no-unused-vars
// eslint-env node
import type { BaileysEventEmitter, ConnectionState } from '@whiskeysockets/baileys'

const state: ConnectionState = { connection: 'close' }

const bind = (ev: BaileysEventEmitter) => {
    ev.on('connection.update', (update) => {
        Object.assign(state, update)
    })

    ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest }) => {
        if (isLatest) {
            chats.clear()

            for (const id in messages) {
                delete messages[id]
            }
        }

        const chatsAdded = chats.insertIfAbsent(...newChats).length
        logger.debug({ chatsAdded }, 'synced chats')

        const oldContacts = contactsUpsert(newContacts)
        if (isLatest) {
            for (const jid of oldContacts) {
                delete contacts[jid]
            }
        }

        logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts')

        for (const msg of newMessages) {
            const jid = msg.key.remoteJid!
            const list = assertMessageList(jid)
            list.upsert(msg, 'prepend')
        }

        logger.debug({ messages: newMessages.length }, 'synced messages')
    })

    ev.on('contacts.upsert', (contacts) => {
        contactsUpsert(contacts)
    })

    ev.on('contacts.update', async (updates) => {
        for (const update of updates) {
            let contact: Contact
            if (contacts[update.id!]) {
                contact = contacts[update.id!]
            } else {
                const contactHashes = await Promise.all(
                    Object.keys(contacts).map(async (contactId) => {
                        const { user } = jidDecode(contactId)!
                        return [
                            contactId,
                            (await md5(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3),
                        ]
                    })
                )
                contact = contacts[contactHashes.find(([, b]) => b === update.id)?.[0] || ''] // find contact by attrs.hash, when user is not saved as a contact
            }

            if (contact) {
                if (update.imgUrl === 'changed') {
                    contact.imgUrl = socket ? await socket?.profilePictureUrl(contact.id) : undefined
                } else if (update.imgUrl === 'removed') {
                    delete contact.imgUrl
                }
            } else {
                return logger.debug({ update }, 'got update for non-existant contact')
            }

            Object.assign(contacts[contact.id], contact)
        }
    })
    ev.on('chats.upsert', (newChats) => {
        chats.upsert(...newChats)
    })
    ev.on('chats.update', (updates) => {
        for (let update of updates) {
            const result = chats.update(update.id!, (chat) => {
                if (update.unreadCount! > 0) {
                    update = { ...update }
                    update.unreadCount = (chat.unreadCount || 0) + update.unreadCount!
                }

                Object.assign(chat, update)
            })
            if (!result) {
                logger.debug({ update }, 'got update for non-existant chat')
            }
        }
    })

    ev.on('labels.edit', (label: Label) => {
        if (label.deleted) {
            return labels.deleteById(label.id)
        }

        // WhatsApp can store only up to 20 labels
        if (labels.count() < 20) {
            return labels.upsertById(label.id, label)
        }

        logger.error('Labels count exceed')
    })

    ev.on('labels.association', ({ type, association }) => {
        switch (type) {
            case 'add':
                labelAssociations.upsert(association)
                break
            case 'remove':
                labelAssociations.delete(association)
                break
            default:
                console.error(`unknown operation type [${type}]`)
        }
    })

    ev.on('presence.update', ({ id, presences: update }) => {
        presences[id] = presences[id] || {}
        Object.assign(presences[id], update)
    })
    ev.on('chats.delete', (deletions) => {
        for (const item of deletions) {
            if (chats.get(item)) {
                chats.deleteById(item)
            }
        }
    })
    ev.on('messages.upsert', ({ messages: newMessages, type }) => {
        switch (type) {
            case 'append':
            case 'notify':
                for (const msg of newMessages) {
                    const jid = jidNormalizedUser(msg.key.remoteJid!)
                    const list = assertMessageList(jid)
                    list.upsert(msg, 'append')

                    if (type === 'notify') {
                        if (!chats.get(jid)) {
                            ev.emit('chats.upsert', [
                                {
                                    id: jid,
                                    conversationTimestamp: toNumber(msg.messageTimestamp),
                                    unreadCount: 1,
                                },
                            ])
                        }
                    }
                }

                break
        }
    })
    ev.on('messages.update', (updates) => {
        for (const { update, key } of updates) {
            const list = assertMessageList(jidNormalizedUser(key.remoteJid!))
            if (update?.status) {
                const listStatus = list.get(key.id!)?.status
                if (listStatus && update?.status <= listStatus) {
                    logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update')
                    delete update.status
                    logger.debug({ update }, 'new update object')
                }
            }

            const result = list.updateAssign(key.id!, update)
            if (!result) {
                logger.debug({ update }, 'got update for non-existent message')
            }
        }
    })
    ev.on('messages.delete', (item) => {
        if ('all' in item) {
            const list = messages[item.jid]
            list?.clear()
        } else {
            const jid = item.keys[0].remoteJid!
            const list = messages[jid]
            if (list) {
                const idSet = new Set(item.keys.map((k) => k.id))
                list.filter((m) => !idSet.has(m.key.id))
            }
        }
    })

    ev.on('groups.update', (updates) => {
        for (const update of updates) {
            const id = update.id!
            if (groupMetadata[id]) {
                Object.assign(groupMetadata[id], update)
            } else {
                logger.debug({ update }, 'got update for non-existant group metadata')
            }
        }
    })

    ev.on('group-participants.update', ({ id, participants, action }) => {
        const metadata = groupMetadata[id]
        if (metadata) {
            switch (action) {
                case 'add':
                    metadata.participants.push(
                        ...participants.map((id) => ({ id, isAdmin: false, isSuperAdmin: false }))
                    )
                    break
                case 'demote':
                case 'promote':
                    for (const participant of metadata.participants) {
                        if (participants.includes(participant.id)) {
                            participant.isAdmin = action === 'promote'
                        }
                    }

                    break
                case 'remove':
                    metadata.participants = metadata.participants.filter((p) => !participants.includes(p.id))
                    break
            }
        }
    })

    ev.on('message-receipt.update', (updates) => {
        for (const { key, receipt } of updates) {
            const obj = messages[key.remoteJid!]
            const msg = obj?.get(key.id!)
            if (msg) {
                updateMessageWithReceipt(msg, receipt)
            }
        }
    })

    ev.on('messages.reaction', (reactions) => {
        for (const { key, reaction } of reactions) {
            const obj = messages[key.remoteJid!]
            const msg = obj?.get(key.id!)
            if (msg) {
                updateMessageWithReaction(msg, reaction)
            }
        }
    })
}
