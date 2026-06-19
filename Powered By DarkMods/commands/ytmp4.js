import { sendReply } from '../lib/helpers.js';
import axios from 'axios';
import yts from 'yt-search';

const HECTOR_API = 'https://yt-dl.officialhectormanuel.workers.dev';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'ytmp4',
    aliases: ['video', 'ytvideo'],
    description: 'Search and download video from YouTube',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;

        let query = '';
        if (args && args.length > 0) {
            query = args.join(' ');
        } else {
            const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const fullCommand = body.slice(userSettings.prefix.length).trim();
            const commandName = fullCommand.split(/\s+/)[0].toLowerCase();
            query = fullCommand.slice(commandName.length).trim();
        }

        if (!query) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT*  」──────\n` +
                `│ 📌 Usage:\n` +
                `│ ${userSettings.prefix}ytmp4 <title>\n` +
                `│\n` +
                `│ 💡 Example:\n` +
                `│ ${userSettings.prefix}ytmp4 Believer\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        try {
            await react(sock, msg, '🔍');

            const searchResults = await yts(query);
            if (!searchResults?.videos?.length) {
                throw new Error(`No results for: ${query}`);
            }

            const video = searchResults.videos[0];
            const youtubeUrl = video.url;

            await react(sock, msg, '⬇️');

            async function fetchVideoData(videoUrl) {
                const apiUrl = `${HECTOR_API}?url=${encodeURIComponent(videoUrl)}`;
                const response = await axios.get(apiUrl, {
                    timeout: 30000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (!response.data?.status) throw new Error('API response invalid');
                return response.data;
            }

            const videoData = await fetchVideoData(youtubeUrl);

            const qualities = ['1080', '720', '480', '360', '240', '144'];
            let videoUrl = null;
            let selectedQuality = null;

            for (const quality of qualities) {
                if (videoData.videos && videoData.videos[quality]) {
                    videoUrl = videoData.videos[quality];
                    selectedQuality = quality;
                    break;
                }
            }

            if (!videoUrl) throw new Error('No video quality available');

            // Envoi des infos
            const caption = 
                `╭─「 *LOVE - XD - BOT*  」────\n` +
                `│ 📀 *${videoData.title || video.title}*\n` +
                `│ 👤 ${video.author.name}\n` +
                `│ ⏱️ ${video.duration.timestamp}\n` +
                `│ 📹 Quality: ${selectedQuality}p\n` +
                `│ ⏳ Downloading...\n` +
                `╰────────────────────`;

            await sock.sendMessage(jid, {
                image: { url: videoData.thumbnail || video.thumbnail },
                caption
            }, { quoted: msg }).catch(() => {});

            // Envoi de la vidéo
            await sock.sendMessage(jid, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: `╭─「 *LOVE - XD - BOT*  」────\n│ ✅ ${videoData.title || video.title}\n│ 📹 Quality: ${selectedQuality}p\n│\n│ ⚡ Powered By DarkMods 🔮\n╰────────────────────`
            }, { quoted: msg });

            await react(sock, msg, '✅');

        } catch (error) {
            console.error('ytmp4 error:', error);
            await react(sock, msg, '❌');

            let errorMsg = error.message;
            if (error.message.includes('timeout')) errorMsg = 'Timeout, try again';
            if (error.response?.status === 404) errorMsg = 'API unavailable';

            await sendReply(sock, jid,
                `╭─「 *LOVE - XD - BOT* 」──────\n` +
                `│ ❌ Download failed\n` +
                `│ ${errorMsg}\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }
    }
};