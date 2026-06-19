import { sendReply } from '../lib/helpers.js';
import axios from 'axios';

const API_KEITH = 'https://apis-keith.vercel.app';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'tools',
    aliases: ['fancy', 'encrypt', 'encrypt2', 'tempmail', 'getmail'],
    description: 'Various tools: fancy text, encryption, temp mail',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message.extendedTextMessage?.text || '';
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args.join(' ').trim();

        try {
            switch (commandName) {
                case 'fancy': await handleFancy(sock, msg, args); break;
                case 'encrypt': await handleEncrypt(sock, msg, query); break;
                case 'encrypt2': await handleEncrypt2(sock, msg, query); break;
                case 'tempmail': await handleTempMail(sock, msg); break;
                case 'getmail': await handleGetMail(sock, msg, query); break;
                default: await sendToolsMenu(sock, msg, userSettings.prefix);
            }
        } catch (error) {
            console.error('Tools error:', error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};

async function sendToolsMenu(sock, msg, prefix) {
    const jid = msg.key.remoteJid;
    await react(sock, msg, '🛠️');
    await sendReply(sock, jid,
        `🛠️ TOOLS MENU\n\n` +
        `.fancy styles <text> - view all styles\n` +
        `.fancy <text> <num> - apply style\n` +
        `.encrypt <code> - encrypt code v1\n` +
        `.encrypt2 <code> - encrypt code v2\n` +
        `.tempmail - generate temp email\n` +
        `.getmail <session> - check inbox`,
        { quoted: msg }
    );
}

async function handleFancy(sock, msg, args) {
    const jid = msg.key.remoteJid;

    if (args.length === 0) {
        await react(sock, msg, '✨');
        return sendReply(sock, jid, `Usage: .fancy styles <text> or .fancy <text> <num>`, { quoted: msg });
    }

    if (args[0].toLowerCase() === 'styles') {
        const text = args.slice(1).join(' ');
        if (!text) return sendReply(sock, jid, `Usage: .fancy styles <text>`, { quoted: msg });

        await react(sock, msg, '📋');
        const { data } = await axios.get(`${API_KEITH}/fancytext/styles?q=${encodeURIComponent(text)}`, { timeout: 30000 });

        if (!data?.styles?.length) {
            return sendReply(sock, jid, `❌ No styles found`, { quoted: msg });
        }

        let message = `✨ Fancy Styles (${data.count}):\n\n`;
        data.styles.slice(0, 10).forEach((style, i) => {
            message += `${i + 1}. ${style.result}\n`;
        });
        message += `\nApply: .fancy ${text} <num>`;
        await sendReply(sock, jid, message, { quoted: msg });
        return;
    }

    const styleNum = parseInt(args[args.length - 1]);
    const text = args.slice(0, -1).join(' ');

    if (isNaN(styleNum)) {
        return sendReply(sock, jid, `Usage: .fancy <text> <number>`, { quoted: msg });
    }

    await react(sock, msg, '✨');
    const { data } = await axios.get(`${API_KEITH}/fancytext?q=${encodeURIComponent(text)}&style=${styleNum}`, { timeout: 30000 });

    if (!data?.result) {
        return sendReply(sock, jid, `❌ Style ${styleNum} not found`, { quoted: msg });
    }

    await sendReply(sock, jid, data.result, { quoted: msg });
    await react(sock, msg, '✅');
}

async function handleEncrypt(sock, msg, code) {
    const jid = msg.key.remoteJid;
    if (!code) return sendReply(sock, jid, `Usage: .encrypt <code>`, { quoted: msg });

    await react(sock, msg, '🔐');
    const { data } = await axios.get(`${API_KEITH}/tools/encrypt?q=${encodeURIComponent(code)}`, { timeout: 30000 });

    if (!data?.result) return sendReply(sock, jid, `❌ Encryption failed`, { quoted: msg });

    await sendReply(sock, jid, `🔐 Encrypted:\n\`\`\`\n${data.result.substring(0, 1500)}\n\`\`\``, { quoted: msg });
    await react(sock, msg, '✅');
}

async function handleEncrypt2(sock, msg, code) {
    const jid = msg.key.remoteJid;
    if (!code) return sendReply(sock, jid, `Usage: .encrypt2 <code>`, { quoted: msg });

    await react(sock, msg, '🔒');
    const { data } = await axios.get(`${API_KEITH}/tools/encrypt2?q=${encodeURIComponent(code)}`, { timeout: 30000 });

    if (!data?.result) return sendReply(sock, jid, `❌ Encryption failed`, { quoted: msg });

    await sendReply(sock, jid, `🔒 Encrypted v2:\n\`\`\`\n${data.result.substring(0, 1500)}\n\`\`\``, { quoted: msg });
    await react(sock, msg, '✅');
}

async function handleTempMail(sock, msg) {
    const jid = msg.key.remoteJid;
    await react(sock, msg, '📧');
    const { data } = await axios.get(`${API_KEITH}/tempmail`, { timeout: 30000 });

    if (!data?.status) return sendReply(sock, jid, `❌ Failed to generate email`, { quoted: msg });

    const [email, session, timestamp] = data.result[0];
    await sendReply(sock, jid,
        `📧 TEMP MAIL\n\nEmail: ${email}\nSession: ${session}\nExpires: ${timestamp}\n\n.getmail ${session} to check inbox`,
        { quoted: msg }
    );
    await react(sock, msg, '✅');
}

async function handleGetMail(sock, msg, sessionId) {
    const jid = msg.key.remoteJid;
    if (!sessionId) return sendReply(sock, jid, `Usage: .getmail <session>`, { quoted: msg });

    await react(sock, msg, '📨');
    const { data } = await axios.get(`${API_KEITH}/get_inbox_tempmail?q=${encodeURIComponent(sessionId)}`, { timeout: 30000 });

    if (!data?.status) return sendReply(sock, jid, `❌ Invalid or expired session`, { quoted: msg });

    let message = `📨 INBOX\n\n`;
    if (data.emails?.length > 0) {
        data.emails.slice(0, 5).forEach((email, i) => {
            message += `${i + 1}. From: ${email.from}\n   Subject: ${email.subject || 'No subject'}\n   ${email.body?.substring(0, 100) || ''}...\n\n`;
        });
    } else {
        message += `No emails yet.`;
    }
    await sendReply(sock, jid, message, { quoted: msg });
    await react(sock, msg, '✅');
};