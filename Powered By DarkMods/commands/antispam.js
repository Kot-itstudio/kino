import { sendReply } from '../lib/helpers.js';
import Database from '../lib/database.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'antispam',
    description: 'Toggle anti-spam protection',

    async execute({ sock, msg, args, groupSettings }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
        }

        const current = groupSettings.antispam_enabled;
        const shouldEnable = action === 'on' ? true : action === 'off' ? false : !current;

        await Database.updateGroupSettings(jid, { antispam_enabled: shouldEnable });
        await react(sock, msg, shouldEnable ? '✅' : '❌');

        return sendReply(sock, jid, shouldEnable ? '🟢 AntiSpam ON' : '🔴 AntiSpam OFF', { quoted: null });
    }
};