import { sendReply } from '../lib/helpers.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TG_API = 'https://api.telegram.org';
const TMP_DIR = path.join(process.cwd(), 'tmp');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// TOKEN à mettre dans config.js ou variable d'environnement
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'VOTRE_TOKEN_ICI';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

async function getTelegramFile(botToken, fileId) {
    const { data } = await axios.get(`${TG_API}/bot${botToken}/getFile`, {
        params: { file_id: fileId },
        timeout: 10000
    });
    if (!data.ok) throw new Error('File not found');
    return data.result.file_path;
}

async function getStickerSet(botToken, packName) {
    const { data } = await axios.get(`${TG_API}/bot${botToken}/getStickerSet`, {
        params: { name: packName },
        timeout: 10000
    });
    if (!data.ok) throw new Error(`Pack not found: ${packName}`);
    return data.result;
}

async function downloadTgFile(botToken, filePath) {
    const url = `${TG_API}/file/bot${botToken}/${filePath}`;
    const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(data);
}

export default {
    name: 'tg',
    aliases: ['tgsticker', 'telesticker'],
    description: 'Download stickers from Telegram',
    usage: 'tg <pack_name or link> [number]',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;

        if (BOT_TOKEN === 'VOTRE_TOKEN_ICI') {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Telegram bot token not configured`, { quoted: msg });
        }

        if (!args[0]) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid,
                `╭─「 TG STICKERS 」─────\n` +
                `│ Usage: .tg <pack_name>\n` +
                `│ .tg <pack_name> 10\n` +
                `│\n` +
                `│ Example: .tg Pepe\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        let packName = args[0];
        if (packName.includes('t.me/addstickers/')) {
            packName = packName.split('t.me/addstickers/')[1].split('?')[0];
        } else if (packName.includes('/')) {
            packName = packName.split('/').pop();
        }

        const maxCount = Math.min(parseInt(args[1]) || 30, 30);

        await react(sock, msg, '🔍');

        if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

        try {
            const pack = await getStickerSet(BOT_TOKEN, packName);
            await react(sock, msg, '⬇️');

            const stickers = pack.stickers.slice(0, maxCount);

            await sendReply(sock, jid,
                `╭─「 TG STICKERS 」─────\n` +
                `│ Pack: ${pack.title}\n` +
                `│ Total: ${pack.stickers.length}\n` +
                `│ Sending: ${stickers.length}\n` +
                `╰────────────────────`,
                { quoted: msg }
            );

            let sent = 0;
            for (const sticker of stickers) {
                try {
                    const filePath = await getTelegramFile(BOT_TOKEN, sticker.file_id);
                    const buffer = await downloadTgFile(BOT_TOKEN, filePath);
                    await sock.sendMessage(jid, { sticker: buffer });
                    sent++;
                    await sleep(500);
                } catch (err) {
                    console.error('Sticker error:', err.message);
                }
            }

            await react(sock, msg, sent > 0 ? '✅' : '❌');
            if (sent < stickers.length) {
                await sendReply(sock, jid, `✅ Sent: ${sent}/${stickers.length}`, { quoted: msg });
            }

        } catch (error) {
            console.error('TG Stickers error:', error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};