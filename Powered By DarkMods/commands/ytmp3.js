import { sendReply } from '../lib/helpers.js';
import axios from 'axios';

const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';
const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'ytmp3',
    aliases: ['audio', 'mp3'],
    description: 'Download audio from YouTube video',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;

        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const url = args?.[0] || body.slice(userSettings.prefix.length + cmdName.length).trim();

        if (!url) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, 
                `╭─「 *LOVE - XD - BOT*  」──────\n` +
                `│ 📌 Usage:\n` +
                `│ ${userSettings.prefix}ytmp3 <url>\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        if (!YT_REGEX.test(url)) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT* 」──────\n` +
                `│ ❌ Invalid YouTube URL\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        await react(sock, msg, '⬇️');

        try {
            const { data } = await axios.get(HECTOR_API, {
                params: { url },
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (!data?.status || !data?.audio) throw new Error('Audio not found');

            // Envoi du titre avec image
            if (data.thumbnail && data.title) {
                await sock.sendMessage(jid, {
                    image: { url: data.thumbnail },
                    caption: `╭─「 *LOVE - XD - BOT* 」────\n│ 📀 *${data.title}*\n│ ⏳ Downloading...\n╰────────────────────`
                }, { quoted: msg }).catch(() => {});
            }

            // Envoi de l'audio
            await sock.sendMessage(jid, {
                audio: { url: data.audio },
                mimetype: 'audio/mpeg',
                filename: `${data.title || 'audio'}.mp3`
            }, { quoted: msg });

            await react(sock, msg, '✅');

        } catch (error) {
            console.error('ytmp3 error:', error.message);
            await react(sock, msg, '❌');

            await sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT* 」──────\n` +
                `│ ❌ Download failed\n` +
                `│ ${error.message.includes('timeout') ? 'Timeout, try again' : error.message}\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }
    }
};