import EventEmitter from 'events'
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    getContentType,
} from '@whiskeysockets/baileys'
import Pino from 'pino'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import { connectDB, getModData } from '../db.js'
import handleCommand from '../commands/mod.js'

const AUTH_DIR = 'auth_info_master'
const STORE_FILE = 'wa_store.json'

export const waBus = new EventEmitter()

let sock = null
let saveCreds = null
let starting = false

export const state = {
    connection: 'close',
    qr: null,
    user: null,
    device: {
        platform: 'Waffen Web',
        browser: 'Chrome',
        version: '120.0.0.0',
    },
}

const chats = new Map()
const messages = new Map()
const rawMessages = new Map()

const loadStore = () => {
    try {
        if (!fs.existsSync(STORE_FILE)) return
        const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'))
        for (const c of data.chats || []) chats.set(c.id, c)
        for (const [jid, list] of Object.entries(data.messages || {})) {
            messages.set(jid, list)
        }
    } catch (e) {
        console.error('[WA] store load:', e.message)
    }
}

const saveStore = () => {
    try {
        const payload = {
            chats: [...chats.values()],
            messages: Object.fromEntries(messages.entries()),
        }
        fs.writeFileSync(STORE_FILE, JSON.stringify(payload))
    } catch (e) {
        console.error('[WA] store save:', e.message)
    }
}

setInterval(saveStore, 15000)

const broadcast = (type, data) => waBus.emit('broadcast', { type, data })

const getPhoneFromJID = (jid) => {
    const match = String(jid).match(/^(\d+)@/)
    return match ? match[1] : jid
}

export const parseMessageContent = (msg) => {
    const m = msg.message
    if (!m) return { type: 'unknown' }
    const type = getContentType(m)
    if (type === 'conversation') return { type: 'text', text: m.conversation }
    if (type === 'extendedTextMessage') return { type: 'text', text: m.extendedTextMessage.text }
    if (type === 'imageMessage') {
        return {
            type: 'image',
            text: m.imageMessage.caption || '',
            mimetype: m.imageMessage.mimetype,
        }
    }
    if (type === 'videoMessage') {
        return { type: 'video', text: m.videoMessage.caption || '', mimetype: m.videoMessage.mimetype }
    }
    if (type === 'audioMessage') return { type: 'audio', mimetype: m.audioMessage.mimetype }
    if (type === 'documentMessage') {
        return {
            type: 'document',
            text: m.documentMessage.caption || '',
            fileName: m.documentMessage.fileName,
            mimetype: m.documentMessage.mimetype,
        }
    }
    if (type === 'stickerMessage') return { type: 'sticker' }
    return { type: 'unknown' }
}

const toUiMessage = (msg) => ({
    id: msg.key.id,
    jid: msg.key.remoteJid,
    fromMe: !!msg.key.fromMe,
    time: Number(msg.messageTimestamp) || Date.now() / 1000,
    pushName: msg.pushName || '',
    content: parseMessageContent(msg),
})

const upsertChat = (jid, patch) => {
    const prev = chats.get(jid) || { id: jid, name: jid.split('@')[0], unread: 0 }
    const next = { ...prev, ...patch, id: jid }
    chats.set(jid, next)
    broadcast('chat', next)
    return next
}

const pushMessage = (msg) => {
    rawMessages.set(`${msg.key.remoteJid}:${msg.key.id}`, msg)
    const ui = toUiMessage(msg)
    const list = messages.get(ui.jid) || []
    if (!list.find((x) => x.id === ui.id)) {
        list.push(ui)
        list.sort((a, b) => a.time - b.time)
        if (list.length > 500) list.splice(0, list.length - 500)
        messages.set(ui.jid, list)
    }

    const preview = ui.content.type === 'text' ? ui.content.text
        : ui.content.type === 'image' ? '📷 Фото'
        : ui.content.type === 'video' ? '🎬 Видео'
        : ui.content.type === 'audio' ? '🎤 Аудио'
        : ui.content.type === 'document' ? '📎 ' + (ui.content.fileName || 'Файл')
        : 'Сообщение'

    upsertChat(ui.jid, {
        lastMessage: preview,
        time: ui.time,
        unread: ui.fromMe ? 0 : (chats.get(ui.jid)?.unread || 0) + 1,
    })

    broadcast('message', { jid: ui.jid, message: ui })
    return ui
}

const resolveChatName = async (jid) => {
    if (!sock) return jid.split('@')[0]
    try {
        if (jid.endsWith('@g.us')) {
            const meta = await sock.groupMetadata(jid)
            return meta.subject
        }
    } catch (_) { /* ignore */ }
    return jid.split('@')[0]
}

const handleBotCommands = async (msg) => {
    if (!msg.message) return
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    if (!text.trim().startsWith('.')) return

    const nowTime = Math.floor(Date.now() / 1000)
    // Пропускаем старые сообщения (>5 сек), но обрабатываем новые
    if ((nowTime - msg.messageTimestamp) > 5) return

    const jid = msg.key.remoteJid
    const senderJID = msg.key.participant || jid
    const sender = getPhoneFromJID(senderJID)

    try {
        const data = await getModData(sender)
        if (data.banned) {
            await sock.sendMessage(jid, { text: '🚫 Вы заблокированы' })
            return
        }
        const parts = text.slice(1).trim().split(/\s+/)
        await handleCommand(sock, jid, sender, parts[0].toLowerCase(), parts.slice(1), [], msg)
    } catch (e) {
        console.error('[CMD]', e.message)
    }
}

const bindEvents = (s) => {
    s.ev.on('creds.update', saveCreds)

    s.ev.on('connection.update', async (update) => {
        console.log('[WA] connection.update', JSON.stringify(update))
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            state.connection = 'qr'
            state.qr = await QRCode.toDataURL(qr, { width: 320, margin: 1 })
            await QRCode.toFile('qr.png', qr, { width: 500 })
            broadcast('status', getPublicStatus())
            broadcast('qr', { qr: state.qr })
        }

        if (connection === 'open') {
            state.connection = 'open'
            state.qr = null
            state.user = s.user || null
            broadcast('status', getPublicStatus())
            console.log('[WA] Подключено:', state.user?.id || 'ok')
        }

        if (connection === 'close') {
            state.connection = 'close'
            state.user = null
            broadcast('status', getPublicStatus())
            const code = lastDisconnect?.error?.output?.statusCode
            if (code === DisconnectReason.loggedOut) {
                state.qr = null
                try {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
                } catch (_) { /* ignore */ }
                broadcast('status', getPublicStatus())
                return
            }
            if (!starting) setTimeout(() => startWhatsApp(), 3000)
        }
    })

    s.ev.on('messaging-history.set', async ({ chats: histChats, messages: histMsgs }) => {
        for (const c of histChats || []) {
            const jid = c.id
            const name = await resolveChatName(jid)
            upsertChat(jid, {
                name,
                time: c.conversationTimestamp || 0,
                archived: !!c.archived,
            })
        }
        for (const m of histMsgs || []) pushMessage(m)
        broadcast('chats', getChats())
    })

    s.ev.on('chats.upsert', async (list) => {
        for (const c of list) {
            const name = await resolveChatName(c.id)
            upsertChat(c.id, { name, time: c.conversationTimestamp || Date.now() / 1000 })
        }
        broadcast('chats', getChats())
    })

    s.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
        for (const m of msgs) {
            pushMessage(m)
            if (type === 'notify') await handleBotCommands(m)
        }
    })
}

export const getPublicStatus = () => ({
    connection: state.connection,
    qr: state.qr,
    user: state.user ? {
        id: state.user.id,
        name: state.user.name || state.user.verifiedName || getPhoneFromJID(state.user.id),
    } : null,
    device: state.device,
})

export const getChats = () => {
    return [...chats.values()]
        .filter((c) => c.id && !c.id.includes('@broadcast'))
        .sort((a, b) => (b.time || 0) - (a.time || 0))
}

export const getChatMessages = (jid, limit = 80) => {
    const list = messages.get(jid) || []
    return list.slice(-limit)
}

export const markChatRead = (jid) => {
    const c = chats.get(jid)
    if (c) {
        c.unread = 0
        chats.set(jid, c)
        broadcast('chat', c)
    }
}

export const startWhatsApp = async () => {
    if (starting) return
    starting = true
    try {
        loadStore()
        const auth = await useMultiFileAuthState(AUTH_DIR)
        console.log('[WA] auth state loaded from', AUTH_DIR)
        saveCreds = auth.saveCreds
        state.connection = 'connecting'
        broadcast('status', getPublicStatus())

        sock = makeWASocket({
            auth: auth.state,
            printQRInTerminal: true,
            logger: Pino({ level: 'debug' }),
            browser: ['Waffen Web', 'Chrome', '120.0.0.0'],
            syncFullHistory: false,
        })

        bindEvents(sock)
    } finally {
        starting = false
    }
}

export const getSocket = () => sock

export const sendText = async (jid, text) => {
    if (!sock || state.connection !== 'open') throw new Error('WhatsApp не подключён')
    const sent = await sock.sendMessage(jid, { text })
    if (sent) pushMessage(sent)
    return sent
}

export const sendMedia = async (jid, buffer, mimetype, fileName, caption = '') => {
    if (!sock || state.connection !== 'open') throw new Error('WhatsApp не подключён')
    let payload
    if (mimetype.startsWith('image/')) {
        payload = { image: buffer, caption }
    } else if (mimetype.startsWith('video/')) {
        payload = { video: buffer, caption, mimetype }
    } else if (mimetype.startsWith('audio/')) {
        payload = { audio: buffer, mimetype, ptt: mimetype.includes('ogg') }
    } else {
        payload = { document: buffer, mimetype, fileName: fileName || 'file', caption }
    }
    const sent = await sock.sendMessage(jid, payload)
    if (sent) pushMessage(sent)
    return sent
}

export const logoutWhatsApp = async () => {
    if (sock) {
        try { await sock.logout() } catch (_) { /* ignore */ }
        sock = null
    }
    state.connection = 'close'
    state.user = null
    state.qr = null
    try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch (_) { /* ignore */ }
    broadcast('status', getPublicStatus())
    await startWhatsApp()
}

export const getMessageMedia = async (jid, messageId) => {
    const msg = rawMessages.get(`${jid}:${messageId}`)
    if (!msg || !sock) return null
    const content = parseMessageContent(msg)
    const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: Pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage },
    )
    return { buffer, mimetype: content.mimetype || 'application/octet-stream' }
}

export const initWa = async () => {
    await connectDB()
    await startWhatsApp()
}
