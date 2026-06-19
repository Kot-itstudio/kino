import { sendReply } from '../lib/helpers.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const MEDIA_DIR = path.join(process.cwd(), 'media');
const GLOBAL_TAG_MP3 = path.join(MEDIA_DIR, 'tag.mp3');
const TAG_STORE_DIR = path.join(process.cwd(), 'data', 'tagsounds');

const userTagPath = (userNumber) => path.join(TAG_STORE_DIR, `${userNumber}.mp3`);

async function ensureDirs() {
    await fs.mkdir(TAG_STORE_DIR, { recursive: true });
    await fs.mkdir(MEDIA_DIR, { recursive: true });
}

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'settag',
    aliases: ['settag', 'cleartag', 'mytag'],
    description: 'Set custom audio for when you are mentioned',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const senderNum = senderJid.split('@')[0];

        await ensureDirs();

        switch (cmdName) {
            case 'settag':
                await handleSetTag(sock, msg, senderNum, jid);
                break;
            case 'cleartag':
                await handleClearTag(sock, msg, senderNum, jid);
                break;
            case 'mytag':
                await handleMyTag(sock, msg, senderNum, jid);
                break;
            default:
                await react(sock, msg, '❓');
        }
    }
};

async function handleSetTag(sock, msg, senderNum, jid) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const audioMsg = quoted?.audioMessage;

    if (!audioMsg) {
        await react(sock, msg, 'ℹ️');
        return sendReply(sock, jid,
            `╭─「 SETTAG 」──────────\n` +
            `│ Reply to an audio with .settag\n` +
            `│\n` +
            `│ Commands:\n` +
            `│ .mytag - check your audio\n` +
            `│ .cleartag - remove your audio\n` +
            `╰────────────────────`,
            { quoted: msg }
        );
    }

    await react(sock, msg, '⏳');

    try {
        const stream = await downloadContentFromMessage(audioMsg, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        if (buffer.length === 0) throw new Error('Empty audio');

        const MAX_SIZE = 5 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Audio too big (max 5MB)`, { quoted: msg });
        }

        const destPath = userTagPath(senderNum);
        await fs.writeFile(destPath, buffer);

        await react(sock, msg, '✅');
        return sendReply(sock, jid,
            `✅ Tag audio saved!\n📦 Size: ${(buffer.length / 1024).toFixed(1)} KB`,
            { quoted: msg }
        );

    } catch (error) {
        await react(sock, msg, '❌');
        return sendReply(sock, jid, `❌ Error: ${error.message}`, { quoted: msg });
    }
}

async function handleClearTag(sock, msg, senderNum, jid) {
    const filePath = userTagPath(senderNum);

    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        await react(sock, msg, '🗑️');
        return sendReply(sock, jid, `✅ Your tag audio has been deleted.`, { quoted: msg });
    } catch {
        await react(sock, msg, 'ℹ️');
        return sendReply(sock, jid, `ℹ️ You don't have a custom tag audio.`, { quoted: msg });
    }
}

async function handleMyTag(sock, msg, senderNum, jid) {
    const filePath = userTagPath(senderNum);
    let hasPerso = false;
    let fileSize = 0;

    try {
        const stat = await fs.stat(filePath);
        hasPerso = true;
        fileSize = stat.size;
    } catch {}

    const hasGlobal = fsSync.existsSync(GLOBAL_TAG_MP3);

    await react(sock, msg, '🔔');
    return sendReply(sock, jid,
        `╭─「 MY TAG AUDIO 」────\n` +
        `│ Personal: ${hasPerso ? `✅ ${(fileSize / 1024).toFixed(1)} KB` : '❌ None'}\n` +
        `│ Global: ${hasGlobal ? '✅ Available' : '❌ Missing'}\n` +
        `│\n` +
        `│ Priority: personal > global\n` +
        `╰────────────────────`,
        { quoted: msg }
    );
}

export async function handleMentionTrigger(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        if (!jid?.endsWith('@g.us')) return;
        if (msg.key.fromMe) return;

        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentions.length === 0) return;

        await ensureDirs();

        for (const mentionedJid of mentions) {
            const mentionedNum = mentionedJid.split('@')[0];
            const personalPath = userTagPath(mentionedNum);
            let audioBuffer = null;

            try {
                await fs.access(personalPath);
                audioBuffer = await fs.readFile(personalPath);
            } catch {}

            if (!audioBuffer && fsSync.existsSync(GLOBAL_TAG_MP3)) {
                audioBuffer = await fs.readFile(GLOBAL_TAG_MP3);
            }

            if (!audioBuffer || audioBuffer.length === 0) continue;

            const sender = msg.key.participant || msg.key.remoteJid;
            if (sender === mentionedJid) continue;

            await sock.sendMessage(jid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: msg });

            console.log(`🔔 Tag audio for @${mentionedNum} in ${jid}`);
        }
    } catch (error) {
        console.error('handleMentionTrigger:', error.message);
    }
};