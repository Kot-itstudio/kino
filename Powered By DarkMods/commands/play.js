import { sendReply } from '../lib/helpers.js';
import axios from 'axios';
import yts from 'yt-search';

const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const fetchAudio = (url) =>
    axios.get(HECTOR_API, {
        params: { url },
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    }).then(({ data }) => {
        if (!data?.status || !data?.audio) throw new Error('Audio introuvable');
        return data;
    });

export default {
    name: 'play',
    aliases: [],
    description: 'Rechercher et télécharger une musique depuis YouTube',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;

        // ── Extraire la requête ─────────────────────────────────────────────
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args?.join(' ') || body.slice(userSettings.prefix.length + cmdName.length).trim();

        if (!query) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT*  」─────────\n` +
                `│ 📌 *Usage :*\n` +
                `│ ${userSettings.prefix}play <titre>\n` +
                `│ Ex: ${userSettings.prefix}play Imagine Dragons\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        await react(sock, msg, '🔍');

        try {
            // ── Recherche YouTube ───────────────────────────────────────────
            const { videos } = await yts(query);
            if (!videos?.length) throw new Error(`Aucun résultat pour: ${query}`);

            const video = videos[0];

            await react(sock, msg, '⬇️');

            // ── Thumbnail + infos ───────────────────────────────────────────
            await sock.sendMessage(jid, {
                image: { url: video.thumbnail },
                caption:
                    `╭─「 🎵 *LOVE - XD - BOT*  」─────\n` +
                    `│ 📀 *${video.title}*\n` +
                    `│ 👤 ${video.author.name}\n` +
                    `│ ⏱️ ${video.duration.timestamp}\n` +
                    `│ ⏳ Envoi en cours...\n` +
                    `╰────────────────────`
            }, { quoted: msg }).catch(() => {});

            // ── Fetch + envoi audio ─────────────────────────────────────────
            const { audio } = await fetchAudio(video.url);

            await sock.sendMessage(jid, {
                audio: { url: audio },
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: msg });

            await react(sock, msg, '✅');

        } catch (error) {
            console.error(`❌ [play]:`, error.message);
            await react(sock, msg, '❌');

            const detail =
                error.message.includes('timeout') ? 'Requête expirée, réessaie.' :
                error.response?.status === 404    ? 'API indisponible.' :
                error.message;

            await sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT* 」─────────\n` +
                `│ ❌ Échec du téléchargement\n` +
                `│ ${detail}\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }
    }
};