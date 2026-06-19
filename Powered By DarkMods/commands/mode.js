import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import { isOwner } from '../lib/groups.js';

export default {
    name: 'private',
    aliases: ['public'],
    description: 'Change bot access mode',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        
        if (!isOwner(msg)) {
            return sendReply(sock, jid, formatError('Owner only command'), { quoted: msg });
        }

        const command = msg.message.conversation?.toLowerCase() || 
                       msg.message.extendedTextMessage?.text?.toLowerCase() || '';
        
        let newMode;
        if (command.includes('private')) {
            newMode = 'private';
        } else if (command.includes('public')) {
            newMode = 'public';
        } else {
            const currentMode = userSettings.bot_mode || 'public';
            return sendReply(sock, jid, 
                `🔒 Current Mode: ${currentMode.toUpperCase()}\n\nCommands:\n• ${userSettings.prefix}private\n• ${userSettings.prefix}public`,
                { quoted: msg }
            );
        }

        try {
            await Database.updateUserSettings({ bot_mode: newMode });
            const modeText = newMode === 'private' ? '🔒 PRIVATE MODE - Owner only' : '🔓 PUBLIC MODE - Everyone can use';
            await sendReply(sock, jid, formatSuccess(modeText), { quoted: msg });
            console.log(`Bot mode updated: ${newMode}`);
        } catch (error) {
            console.error('Mode error:', error);
            await sendReply(sock, jid, formatError('Database error'), { quoted: msg });
        }
    }
};