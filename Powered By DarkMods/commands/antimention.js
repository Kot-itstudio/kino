import { sendReply } from '../lib/helpers.js';
import Database from '../lib/database.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'antimention',
    aliases: ['antigroupmention'],
    description: 'Prevent group mentions in status and messages',

    async execute({ sock, msg, args, groupSettings }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
        }

        const current = groupSettings.antimention_enabled;

        if (!action || action === 'status') {
            return sendReply(sock, jid, current ? '🟢 AntiMention ON' : '🔴 AntiMention OFF', { quoted: msg });
        }

        const shouldEnable = action === 'on';

        await Database.updateGroupSettings(jid, { antimention_enabled: shouldEnable });
        await react(sock, msg, shouldEnable ? '✅' : '❌');

        return sendReply(sock, jid, shouldEnable ? '🟢 AntiMention ON' : '🔴 AntiMention OFF', { quoted: null });
    }
};