import { sendReply } from '../lib/helpers.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'warnings',
    aliases: ['warns'],
    description: 'View or reset user warnings',
    
    async execute({ sock, msg, args, userSettings, getUserWarnings, resetUserWarnings }) {
        const jid = msg.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
        }

        const action = args[0]?.toLowerCase();
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (action === 'reset') {
            if (mentions.length > 0) {
                const targetUser = mentions[0];
                resetUserWarnings(targetUser);
                await react(sock, msg, '✅');
                return sendReply(sock, jid, `✅ Warnings reset for @${targetUser.split('@')[0]}`, { quoted: msg, mentions: [targetUser] });
            } else {
                resetUserWarnings();
                await react(sock, msg, '✅');
                return sendReply(sock, jid, `✅ All warnings reset in this group`, { quoted: msg });
            }
        }

        if (mentions.length > 0) {
            const targetUser = mentions[0];
            const warnings = getUserWarnings(targetUser);
            await sendReply(sock, jid,
                `⚠️ WARNINGS for @${targetUser.split('@')[0]}\n\n` +
                `Anti-Link: ${warnings.antilink || 0}/3\n` +
                `Anti-Spam: ${warnings.antispam || 0}/3\n\n` +
                `Reset: ${userSettings.prefix}warnings reset @user`,
                { quoted: msg, mentions: [targetUser] }
            );
        } else {
            await sendReply(sock, jid,
                `⚠️ WARNINGS SYSTEM\n\n` +
                `${userSettings.prefix}warnings @user - Check user\n` +
                `${userSettings.prefix}warnings reset @user - Reset user\n` +
                `${userSettings.prefix}warnings reset - Reset all`,
                { quoted: msg }
            );
        }
    }
};