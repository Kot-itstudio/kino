import 'dotenv/config'
import express from 'express'
import { WebSocketServer } from 'ws'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { exec } from 'child_process'
import {
    initWa,
    waBus,
    getPublicStatus,
    getChats,
    getChatMessages,
    markChatRead,
    sendText,
    sendMedia,
    logoutWhatsApp,
    getMessageMedia,
    getSocket,
} from './lib/wa-client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.join(__dirname, '..', 'WaffenAPP', 'web')
const PORT = Number(process.env.PORT || 3000)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024 * 1024 } })
const app = express()
app.use(express.json({ limit: '2mb' }))

const clients = new Set()

waBus.on('broadcast', ({ type, data }) => {
    const payload = JSON.stringify({ type, data })
    for (const ws of clients) {
        if (ws.readyState === 1) ws.send(payload)
    }
})

const api = express.Router()

api.get('/status', (_req, res) => res.json(getPublicStatus()))

api.get('/chats', (_req, res) => res.json(getChats()))

api.get('/chats/:jid/messages', (req, res) => {
    const jid = decodeURIComponent(req.params.jid)
    res.json(getChatMessages(jid, Number(req.query.limit) || 80))
})

api.post('/chats/:jid/read', (req, res) => {
    markChatRead(decodeURIComponent(req.params.jid))
    res.json({ ok: true })
})

api.post('/chats/:jid/send', async (req, res) => {
    try {
        const jid = decodeURIComponent(req.params.jid)
        const { text } = req.body
        if (!text?.trim()) return res.status(400).json({ error: 'Пустое сообщение' })
        await sendText(jid, text.trim())
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

api.post('/chats/:jid/send-media', upload.single('file'), async (req, res) => {
    try {
        const jid = decodeURIComponent(req.params.jid)
        if (!req.file) return res.status(400).json({ error: 'Нет файла' })
        await sendMedia(
            jid,
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname,
            req.body.caption || '',
        )
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

api.get('/chats/:jid/media/:msgId', async (req, res) => {
    try {
        const jid = decodeURIComponent(req.params.jid)
        const media = await getMessageMedia(jid, req.params.msgId)
        if (!media) return res.status(404).end()
        res.setHeader('Content-Type', media.mimetype)
        res.send(media.buffer)
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

api.post('/devices/logout', async (_req, res) => {
    try {
        await logoutWhatsApp()
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

api.get('/devices', (_req, res) => {
    const st = getPublicStatus()
    res.json({
        current: {
            name: 'Waffen Web',
            platform: st.device.platform,
            browser: `${st.device.browser} ${st.device.version}`,
            connected: st.connection === 'open',
            user: st.user,
        },
    })
})

api.post('/chats/:jid/refresh-name', async (req, res) => {
    try {
        const jid = decodeURIComponent(req.params.jid)
        const sock = getSocket()
        if (!sock) return res.status(503).json({ error: 'Не подключено' })
        const name = await (async () => {
            if (jid.endsWith('@g.us')) {
                const meta = await sock.groupMetadata(jid)
                return meta.subject
            }
            return jid.split('@')[0]
        })()
        res.json({ name })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

app.use('/api', api)
app.use(express.static(WEB_ROOT))
app.get('*', (_req, res) => {
    res.sendFile(path.join(WEB_ROOT, 'index.html'))
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
    clients.add(ws)
    ws.send(JSON.stringify({ type: 'status', data: getPublicStatus() }))
    ws.send(JSON.stringify({ type: 'chats', data: getChats() }))
    ws.on('close', () => clients.delete(ws))
})

server.listen(PORT, () => {
    console.log(`\n  Waffen Web: http://localhost:${PORT}\n`)
    console.log('  QR-код появится в браузере после сканирования\n')
    if (process.platform === 'win32') {
        exec(`start http://localhost:${PORT}`)
    }
})

initWa().catch((err) => {
    console.error('[SERVER] init error:', err)
    process.exit(1)
})
