import { sendReply } from '../lib/helpers.js';
import Database from '../lib/database.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'greet',
    aliases: ['welcome', 'goodbye'],
    description: 'Manage welcome and goodbye messages',

    async execute({ sock, msg, args, groupSettings }) {
        const jid = msg.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, '❌ Group only', { quoted: msg });
        }

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const prefix = groupSettings.prefix || '.';
        const commandName = body.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const action = args[0]?.toLowerCase();

        // Welcome/Goodbye direct commands
        if (commandName === 'welcome') {
            const newValue = action === 'on' ? true : action === 'off' ? false : !groupSettings.welcome_enabled;
            await Database.updateGroupSettings(jid, { welcome_enabled: newValue });
            await react(sock, msg, newValue ? '✅' : '❌');
            return sendReply(sock, jid, `👋 Welcome ${newValue ? 'ON' : 'OFF'}`, { quoted: msg });
        }

        if (commandName === 'goodbye') {
            const newValue = action === 'on' ? true : action === 'off' ? false : !groupSettings.goodbye_enabled;
            await Database.updateGroupSettings(jid, { goodbye_enabled: newValue });
            await react(sock, msg, newValue ? '✅' : '❌');
            return sendReply(sock, jid, `👋 Goodbye ${newValue ? 'ON' : 'OFF'}`, { quoted: msg });
        }

        // Greet command
        if (!action || action === 'status') {
            return sendReply(sock, jid,
                `╭─「 GREET 」──────────\n` +
                `│ 👋 Welcome: ${groupSettings.welcome_enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                `│ 👋 Goodbye: ${groupSettings.goodbye_enabled ? '🟢 ON' : '🔴 OFF'}\n` +
                `│\n` +
                `│ Commands:\n` +
                `│ .welcome on/off\n` +
                `│ .goodbye on/off\n` +
                `╰────────────────────`,
                { quoted: msg }
            );
        }

        if (action === 'both') {
            const newWelcome = !groupSettings.welcome_enabled;
            const newGoodbye = !groupSettings.goodbye_enabled;
            await Database.updateGroupSettings(jid, { welcome_enabled: newWelcome, goodbye_enabled: newGoodbye });
            await react(sock, msg, '✅');
            return sendReply(sock, jid,
                `👋 Welcome: ${newWelcome ? 'ON' : 'OFF'}\n👋 Goodbye: ${newGoodbye ? 'ON' : 'OFF'}`,
                { quoted: msg }
            );
        }

        await react(sock, msg, '❌');
    }
};