import { sendReply } from '../lib/helpers.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'utils',
    aliases: ['getpp', 'pp', 'profilepic', 'avatar', 'setpp', 'jid', 'idch'],
    description: 'Utility commands',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message.extendedTextMessage?.text || '';
        const prefix = '.';
        const commandName = body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            switch (commandName) {
                case 'getpp':
                case 'pp':
                case 'profilepic':
                case 'avatar':
                    await handleGetPP(sock, msg, args);
                    break;
                case 'setpp':
                    await handleSetPP(sock, msg);
                    break;
                case 'jid':
                    await handleJID(sock, msg);
                    break;
                case 'idch':
                    await handleIDCH(sock, msg);
                    break;
                default:
                    await react(sock, msg, '❓');
            }
        } catch (error) {
            console.error('Utils error:', error.message);
            await react(sock, msg, '❌');
        }
    }
};

async function handleGetPP(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    let targetJid = null;
    let targetName = '';

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (mentioned) {
        targetJid = mentioned;
        targetName = mentioned.split('@')[0];
    } else if (quoted) {
        targetJid = msg.key.participant || jid;
        targetName = targetJid.split('@')[0];
    } else if (args[0]) {
        const number = args[0].replace(/[^0-9]/g, '');
        if (number.length >= 8) {
            targetJid = number + '@s.whatsapp.net';
            targetName = number;
        }
    } else if (isGroup) {
        targetJid = jid;
        targetName = 'Group';
    } else {
        targetJid = jid;
        targetName = jid.split('@')[0];
    }

    if (!targetJid) {
        await react(sock, msg, '❌');
        return;
    }

    await react(sock, msg, '⏳');

    try {
        const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        await sock.sendMessage(jid, { image: { url: ppUrl }, caption: `📸 Profile: ${targetName}` }, { quoted: msg });
        await react(sock, msg, '✅');
    } catch {
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ No profile picture found`, { quoted: msg });
    }
}

async function handleSetPP(sock, msg) {
    const jid = msg.key.remoteJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imageMessage = quoted?.imageMessage;

    if (!imageMessage) {
        await react(sock, msg, '❌');
        return sendReply(sock, jid, `Reply to an image with .setpp`, { quoted: msg });
    }

    await react(sock, msg, '⏳');

    try {
        const buffer = await downloadMediaMessage({ message: quoted, key: msg.key }, 'buffer', {});
        await sock.updateProfilePicture(jid, buffer);
        await react(sock, msg, '✅');
        await sendReply(sock, jid, `✅ Profile picture updated`, { quoted: msg });
    } catch (error) {
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ Failed: ${error.message}`, { quoted: msg });
    }
}

async function handleJID(sock, msg) {
    const jid = msg.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
    }

    await react(sock, msg, '⏳');
    const metadata = await sock.groupMetadata(jid);

    await sendReply(sock, jid,
        `📊 GROUP INFO\n\nName: ${metadata.subject}\nJID: ${jid}\nMembers: ${metadata.participants.length}\nAdmins: ${metadata.participants.filter(p => p.admin).length}`,
        { quoted: msg }
    );
    await react(sock, msg, '✅');
}

async function handleIDCH(sock, msg) {
    const jid = msg.key.remoteJid;
    if (!jid.includes('@newsletter')) {
        return sendReply(sock, jid, `❌ Channel only`, { quoted: msg });
    }

    await react(sock, msg, '✅');
    await sendReply(sock, jid, `📢 CHANNEL ID\n\n${jid}`, { quoted: msg });
};