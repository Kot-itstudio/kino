import axios from 'axios';
import { sendReply } from '../lib/helpers.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const UPLOAD_API = 'https://apis-starlights-team.koyeb.app/starlight';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'upload',
    aliases: ['upload', 'mirror', 'host'],
    description: 'Upload media to get URL',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const url = args[0]?.trim();

        let mediaBuffer = null;
        let mediaType = null;

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            mediaBuffer = url;
            mediaType = 'url';
        } else if (quoted?.imageMessage) {
            mediaBuffer = await downloadMediaMessage({ message: quoted, key: msg.key }, 'buffer', {});
            mediaType = 'image';
        } else if (quoted?.videoMessage) {
            mediaBuffer = await downloadMediaMessage({ message: quoted, key: msg.key }, 'buffer', {});
            mediaType = 'video';
        } else if (quoted?.audioMessage) {
            mediaBuffer = await downloadMediaMessage({ message: quoted, key: msg.key }, 'buffer', {});
            mediaType = 'audio';
        }

        if (!mediaBuffer) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `Usage: .upload <url> or reply to a media`, { quoted: msg });
        }

        await react(sock, msg, '📤');

        const formData = new FormData();
        if (mediaType === 'url') {
            formData.append('url', mediaBuffer);
        } else {
            formData.append('file', new Blob([mediaBuffer]), 'upload.mp4');
        }

        try {
            const response = await axios.post(`${UPLOAD_API}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000
            });

            if (response.data?.url) {
                await sendReply(sock, jid, `✅ Upload successful!\n\nURL: ${response.data.url}`, { quoted: msg });
                await react(sock, msg, '✅');
            } else {
                throw new Error('No URL returned');
            }
        } catch (error) {
            console.error('Upload error:', error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ Upload failed: ${error.message}`, { quoted: msg });
        }
    }
};