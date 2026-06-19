import 'dotenv/config'


import makeWASocket, { useMultiFileAuthState, DisconnectReason, getContentType } from '@whiskeysockets/baileys'
import Pino from 'pino'
import QRCode from 'qrcode'
import qrcodeTerminal from 'qrcode-terminal'
import { connectDB, getModData } from './db.js'
import handleCommand from './commands/mod.js'
import logger from './lib/logger.js'
import fs from 'fs'
import path from 'path'

const getPhoneFromJID = (jid) => jid?.match(/^(\d+)@/)?.[1] || jid

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_master')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: 'fatal' }),
        browser: ['WaffenBOT', 'Chrome', '120.0.0.0'],
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update

        if (qr) {
            logger.info('QR-код сгенерирован (сохранён в qr.png)')
            // Чтобы быстро показать QR в браузере — делаем png меньше и HTML компактнее
            const outDir = __dirname

            // PNG для браузера/перезапуска, HTML — чтобы показывался в браузере без консоли
            await QRCode.toFile('qr.png', qr, { width: 200 }).catch(e => {
                logger.error('Ошибка сохранения QR:', e.message)
            })

            await fs.promises.writeFile(path.join(__dirname, 'qr.html'), html, 'utf8').catch(e => {
                logger.error('Ошибка сохранения qr.html:', e.message)
            })

            qrcodeTerminal.generate(qr, { small: true })
            logger.info('Откройте qr.html в браузере: e:/Roman/Projects/WaffenBOT/qr.html')
        }

        if (connection === 'open') {
            logger.info('[WaffenBOT] Авторизация успешна')
        }

        if (connection === 'close') {
            const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) {
                setTimeout(() => startBot(), 5000)
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue

                const jid = msg.key.remoteJid
                const sender = getPhoneFromJID(msg.key.participant || jid)
                
                const txt = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
                if (!txt) continue

                const isGroup = jid?.endsWith('@g.us')



                // Логика фильтрации групп:
                // - В ЛС бот всегда отвечает
                // - В группах бот отвечает ТОЛЬКО если в описании группы есть шаблон: {Test: arbuz@waffen.BOT}
                if (isGroup) {
                    try {
                        const meta = await sock.groupMetadata(jid)
                        const desc = meta?.desc || meta?.description || ''
                        const ok = /\{\s*Test\s*:\s*[^}]*\}/i.test(desc)
                        if (!ok) continue
                    } catch (e) {
                        logger.error('[GROUP FILTER] groupMetadata error:', e.message)
                        continue
                    }
                }


                logger.debug(`${sender}: ${txt.substring(0, 40)}`)

                if (!txt.startsWith('.')) continue

                const [cmd, ...args] = txt.slice(1).trim().split(/\s+/)
                
                const data = await getModData(sender)
                if (data.banned) {
                    await sock.sendMessage(jid, { text: '🚫 Заблокирован' })
                    continue
                }

                logger.info(`CMD ${cmd}`)
                await handleCommand(sock, jid, sender, cmd.toLowerCase(), args, [], msg, isGroup)
            } catch (e) {



                logger.error('messages.upsert handler error:', e.message)
            }
        }
    })
}

connectDB().then(() => {
    logger.info('[DB] ✓ Подключено — запускаю Baileys')
    startBot()
}).catch(err => {
    logger.error('[DB ERROR]', err)
    process.exit(1)
})
