import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Database from './database.js';

// ══════════════════════════════════════════════
//   font() — police 𝙿𝙾𝙻𝙸𝙲𝙴 unique
// ══════════════════════════════════════════════
function font(text) {
    if (!text || typeof text !== 'string') return text || '';

    const map = {
        'a':'𝚊','b':'𝚋','c':'𝚌','d':'𝚍','e':'𝚎','f':'𝚏','g':'𝚐',
        'h':'𝚑','i':'𝚒','j':'𝚓','k':'𝚔','l':'𝚕','m':'𝚖','n':'𝚗',
        'o':'𝚘','p':'𝚙','q':'𝚚','r':'𝚛','s':'𝚜','t':'𝚝','u':'𝚞',
        'v':'𝚟','w':'𝚠','x':'𝚡','y':'𝚢','z':'𝚣',
        'A':'𝙰','B':'𝙱','C':'𝙲','D':'𝙳','E':'𝙴','F':'𝙵','G':'𝙶',
        'H':'𝙷','I':'𝙸','J':'𝙹','K':'𝙺','L':'𝙻','M':'𝙼','N':'𝙽',
        'O':'𝙾','P':'𝙿','Q':'𝚀','R':'𝚁','S':'𝚂','T':'𝚃','U':'𝚄',
        'V':'𝚅','W':'𝚆','X':'𝚇','Y':'𝚈','Z':'𝚉'
    };

    return text.split('').map(c => map[c] ?? c).join('');
}

// ══════════════════════════════════════════════
//   buildAdReplyContext() - style du message
// ══════════════════════════════════════════════
function buildAdReplyContext() {
    return {
        externalAdReply: {
            title: font("LOVE-XD-BOT"),
            body: font("Powered By DarkMods"),
            thumbnailUrl: 'https://i.postimg.cc/HWZYvSwC/81b804a0a2c4cbf6e2c0e020e43ee17e.jpg',
            sourceUrl: 'https://whatsapp.com/channel/0029VbC2bKSA2pLJLm765C3Z',
            mediaType: 1,
            renderLargerThumbnail: false
        }
    };
}

// ══════════════════════════════════════════════
//   sendReply() - envoi avec style (SANS >)
// ══════════════════════════════════════════════
async function sendReply(sock, to, text, options = {}) {
    try {
        if (!sock || typeof sock.sendMessage !== 'function') {
            console.error('sock.sendMessage is not a function');
            return false;
        }

        if (!text || typeof text !== 'string') text = "Empty Message";

        const messageOptions = {
            text: text,
            contextInfo: buildAdReplyContext()
        };

        if (options.mentions && Array.isArray(options.mentions) && options.mentions.length > 0) {
            messageOptions.mentions = options.mentions;
            messageOptions.contextInfo.mentionedJid = options.mentions;
        }

        const messageConfig = {};
        if (options.quoted && options.quoted.key) {
            messageConfig.quoted = options.quoted;
        }

        await sock.sendMessage(to, messageOptions, messageConfig);
        return true;
    } catch (error) {
        console.error('SendReply Error:', error.message);
        return false;
    }
}

// ══════════════════════════════════════════════
//   sendMessage() - envoi sans modif (brut)
// ══════════════════════════════════════════════
async function sendMessage(sock, to, text, options = {}) {
    try {
        if (!sock || typeof sock.sendMessage !== 'function') {
            console.error('sock.sendMessage is not a function');
            return false;
        }

        const messageOptions = {
            text: text,
            contextInfo: buildAdReplyContext()
        };

        if (options.mentions && Array.isArray(options.mentions) && options.mentions.length > 0) {
            messageOptions.mentions = options.mentions;
            messageOptions.contextInfo.mentionedJid = options.mentions;
        }

        const messageConfig = {};
        if (options.quoted && options.quoted.key) {
            messageConfig.quoted = options.quoted;
        }

        await sock.sendMessage(to, messageOptions, messageConfig);
        return true;
    } catch (error) {
        console.error('sendMessage error:', error.message);
        return false;
    }
}

// ══════════════════════════════════════════════
//   Formattage simple (sans >)
// ══════════════════════════════════════════════
function formatError(text) {
    if (!text || typeof text !== 'string') return "❌ Error";
    return `❌ ${text}`;
}

function formatSuccess(text) {
    if (!text || typeof text !== 'string') return "✅ Success";
    return `✅ ${text}`;
}

function formatHelp(text) {
    if (!text || typeof text !== 'string') return "📖 Help";
    return `📖 ${text}`;
}

// ══════════════════════════════════════════════
//   updateSessionSettings()
// ══════════════════════════════════════════════
async function updateSessionSettings(updates) {
    try {
        await Database.updateUserSettings(updates);
        console.log('✅ Session settings updated:', Object.keys(updates));
        return true;
    } catch (error) {
        console.error('❌ Error updating session settings:', error.message);
        return false;
    }
}

export {
    font,
    sendReply,
    sendMessage,
    formatError,
    formatSuccess,
    formatHelp,
    updateSessionSettings,
    buildAdReplyContext
};