import { sendReply } from '../lib/helpers.js';
import Database from '../lib/database.js';
import MessageStore from '../messageStore.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { writeFile, unlink } from 'fs/promises';
import config from '../config.js';
import path from 'path';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const MEDIA_EXT = { image: 'jpg', video: 'mp4', sticker: 'webp', audio: 'mp3' };

export default {
    name: 'antidelete',
    aliases: ['ad', 'antisupp'],
    description: 'Enable/disable anti-delete system',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (!action || !['on', 'off', 'status'].includes(action)) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `Usage: .antidelete on/off/status`, { quoted: msg });
        }

        try {
            const settings = await Database.getUserSettings();

            if (action === 'status') {
                await react(sock, msg, settings.antidelete_enabled ? '✅' : '❌');
                return sendReply(sock, jid, settings.antidelete_enabled ? '🟢 AntiDelete ON' : '🔴 AntiDelete OFF', { quoted: msg });
            }

            const shouldEnable = action === 'on';

            if (settings.antidelete_enabled === shouldEnable) {
                await react(sock, msg, '⚠️');
                return sendReply(sock, jid, `Already ${shouldEnable ? 'ON' : 'OFF'}`, { quoted: msg });
            }

            await Database.updateUserSettings({ antidelete_enabled: shouldEnable });
            await react(sock, msg, shouldEnable ? '✅' : '❌');
            return sendReply(sock, jid, shouldEnable ? '🟢 AntiDelete ON' : '🔴 AntiDelete OFF', { quoted: msg });

        } catch (error) {
            console.error('AntiDelete cmd:', error.message);
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};

export async function storeMessage(msg, sock) {
    try {
        const settings = await Database.getUserSettings();
        if (!settings.antidelete_enabled || !msg.key?.id) return;

        let content = '';
        let mediaInfo = null;

        const m = msg.message;
        if (m?.conversation) content = m.conversation;
        else if (m?.extendedTextMessage?.text) content = m.extendedTextMessage.text;
        else if (m?.imageMessage) {
            mediaInfo = await downloadMedia(msg.key.id, m.imageMessage, 'image');
            content = m.imageMessage.caption || '';
        }
        else if (m?.videoMessage) {
            mediaInfo = await downloadMedia(msg.key.id, m.videoMessage, 'video');
            content = m.videoMessage.caption || '';
        }
        else if (m?.stickerMessage) mediaInfo = await downloadMedia(msg.key.id, m.stickerMessage, 'sticker');
        else if (m?.audioMessage) mediaInfo = await downloadMedia(msg.key.id, m.audioMessage, 'audio');

        await MessageStore.storeMessage(msg, content, mediaInfo);
    } catch (err) {
        console.error('storeMessage:', err.message);
    }
}

export async function handleMessageRevocation(revocationMsg, sock) {
    try {
        const settings = await Database.getUserSettings();
        if (!settings.antidelete_enabled) return;

        const messageId = revocationMsg.message?.protocolMessage?.key?.id;
        if (!messageId) return;

        const original = MessageStore.getMessage(messageId);
        if (!original) return;

        const deletedBy = revocationMsg.key.participant || revocationMsg.key.remoteJid;
        if (deletedBy.includes(sock.user.id.split('@')[0])) return;

        const ownerJid = `${config.owner}@s.whatsapp.net`;
        await sendDeleteNotification(sock, original, deletedBy, ownerJid);
        
        if (original.mediaPath) await unlink(original.mediaPath).catch(() => {});
        MessageStore.deleteMessage(messageId);
    } catch (err) {
        console.error('handleMessageRevocation:', err.message);
    }
}

async function downloadMedia(messageId, mediaMsg, type) {
    try {
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        if (!buffer.length) throw new Error('Empty buffer');

        const ext = type === 'audio' && mediaMsg.mimetype?.includes('ogg') ? 'ogg' : MEDIA_EXT[type] || 'bin';
        const filePath = path.join(process.cwd(), 'tmp', `${messageId}.${ext}`);
        
        await writeFile(filePath, buffer);
        return { type, path: filePath };
    } catch (err) {
        console.error('downloadMedia:', err.message);
        return null;
    }
}

async function sendDeleteNotification(sock, original, deletedBy, ownerJid) {
    try {
        const senderName = original.sender?.split('@')[0];
        const deletedByName = deletedBy.split('@')[0];
        
        const text = `🗑️ MESSAGE SUPPRIME\nDe: @${senderName}\nPar: @${deletedByName}\nContenu: ${original.content || '[MEDIA]'}`;

        await sock.sendMessage(ownerJid, { text, mentions: [deletedBy, original.sender] });

        if (original.mediaPath && original.mediaType) {
            const mediaMsg = { caption: `Media de @${senderName}`, mentions: [original.sender] };
            if (original.mediaType === 'image') await sock.sendMessage(ownerJid, { image: { url: original.mediaPath }, ...mediaMsg });
            if (original.mediaType === 'video') await sock.sendMessage(ownerJid, { video: { url: original.mediaPath }, ...mediaMsg });
            if (original.mediaType === 'sticker') await sock.sendMessage(ownerJid, { sticker: { url: original.mediaPath } });
        }
    } catch (err) {
        console.error('sendDeleteNotification:', err.message);
    }
};