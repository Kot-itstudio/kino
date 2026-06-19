import fs from 'fs/promises';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import Database from '../lib/database.js';
import config from '../config.js';

const MEDIA_BASE_DIR = './user_media';

async function ensureUserMediaDir() {
    const userDir = path.join(MEDIA_BASE_DIR, config.owner);
    await fs.mkdir(userDir, { recursive: true });
    return userDir;
}

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'media',
    aliases: ['store', 'vd', 'ad', 'list', 'del', 's', 'sticker', 'take', 'steal'],
    description: 'Manage your media collection',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            const userDir = await ensureUserMediaDir();

            switch(commandName) {
                case 'store': {
                    if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) {
                        await react(sock, msg, '❌');
                        return;
                    }
                    const name = args[0];
                    if (!name) return sendReply(sock, jid, 'Usage: !store name', { quoted: msg });

                    const mediaType = quoted.videoMessage ? 'video' : 'audio';
                    const extension = mediaType === 'video' ? '.mp4' : '.mp3';
                    const fileName = name.toLowerCase() + extension;
                    const mediaPath = path.join(userDir, fileName);

                    const existing = await Database.getUserMedia(mediaType);
                    if (existing.some(m => m.media_name === name.toLowerCase())) {
                        return sendReply(sock, jid, `❌ ${mediaType} "${name}" already exists`, { quoted: msg });
                    }

                    await react(sock, msg, '📥');
                    const mediaMessage = quoted.videoMessage || quoted.audioMessage;
                    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    await fs.writeFile(mediaPath, buffer);
                    await Database.saveUserMedia(name, mediaType, mediaPath);
                    await react(sock, msg, '✅');
                    break;
                }

                case 'vd': {
                    const isCircular = args.includes('-c');
                    const name = args.filter(arg => arg !== '-c')[0];
                    if (!name) return sendReply(sock, jid, 'Usage: !vd name', { quoted: msg });

                    const userMedia = await Database.getUserMedia('video');
                    const media = userMedia.find(m => m.media_name === name.toLowerCase());
                    if (!media) return sendReply(sock, jid, `❌ Video "${name}" not found`, { quoted: msg });

                    await react(sock, msg, '🎬');
                    const videoBuffer = await fs.readFile(media.file_path);
                    await sock.sendMessage(jid, { video: videoBuffer, caption: `📹 ${name}`, ptv: isCircular }, { quoted: msg });
                    break;
                }

                case 'ad': {
                    const name = args[0];
                    if (!name) return sendReply(sock, jid, 'Usage: !ad name', { quoted: msg });

                    const userMedia = await Database.getUserMedia('audio');
                    const media = userMedia.find(m => m.media_name === name.toLowerCase());
                    if (!media) return sendReply(sock, jid, `❌ Audio "${name}" not found`, { quoted: msg });

                    await react(sock, msg, '🎵');
                    const audioBuffer = await fs.readFile(media.file_path);
                    await sock.sendMessage(jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
                    break;
                }

                case 'list': {
                    const mediaList = await Database.getUserMedia();
                    const videos = mediaList.filter(m => m.media_type === 'video');
                    const audios = mediaList.filter(m => m.media_type === 'audio');
                    let message = `📁 Your media (${mediaList.length}):\n\n`;
                    if (videos.length) message += `🎬 VIDEOS:\n${videos.map(v => `• ${v.media_name}`).join('\n')}\n\n`;
                    if (audios.length) message += `🎵 AUDIOS:\n${audios.map(a => `• ${a.media_name}`).join('\n')}`;
                    if (!mediaList.length) message = '📁 No media saved';
                    await sock.sendMessage(jid, { text: message }, { quoted: msg });
                    break;
                }

                case 'del': {
                    const type = args[0]?.toLowerCase();
                    const name = args[1];
                    if (!type || !name || !['audio', 'video'].includes(type)) {
                        return sendReply(sock, jid, 'Usage: !del audio|video name', { quoted: msg });
                    }
                    const deleted = await Database.deleteUserMedia(name, type);
                    await react(sock, msg, deleted ? '✅' : '❌');
                    break;
                }

                case 'sticker':
                case 's': {
                    const mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage || quoted?.imageMessage || quoted?.videoMessage;
                    if (!mediaMessage) {
                        await react(sock, msg, '❌');
                        return;
                    }
                    await react(sock, msg, '✍️');
                    const mediaType = mediaMessage.mimetype.includes('video') ? 'video' : 'image';
                    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    const sticker = new Sticker(buffer, { pack: 'LOVE-XD-BOT', author: '𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬', type: StickerTypes.FULL, quality: 70 });
                    await sock.sendMessage(jid, await sticker.toMessage(), { quoted: msg });
                    await react(sock, msg, '✅');
                    break;
                }

                case 'take':
                case 'steal': {
                    if (!quoted || !quoted.stickerMessage) {
                        await react(sock, msg, '❌');
                        return;
                    }
                    await react(sock, msg, '🔄');
                    const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    const [pack, author] = args.join(' ').split('|').map(s => s.trim());
                    const sticker = new Sticker(buffer, { pack: pack || 'DarkMods', author: author || 'Bot', type: StickerTypes.FULL, quality: 70 });
                    await sock.sendMessage(jid, await sticker.toMessage(), { quoted: msg });
                    await react(sock, msg, '✅');
                    break;
                }
            }
        } catch (error) {
            console.error('Media error:', error);
            await react(sock, msg, '❌');
        }
    }
};