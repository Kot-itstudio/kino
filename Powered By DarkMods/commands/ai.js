import axios from 'axios';
import { sendReply } from '../lib/helpers.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = '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';
const MODEL = 'llama-3.1-8b-instant';
const MAX_TOKENS = 512;
const TIMEOUT_MS = 20000;

const PROMPTS = {
    loveai: `Tu es Afna, la personification de Love-XD ,reine de DarkMods. Tu aimes DarkMods plus que tout. Réponds de façon élégante, mystérieuse et coquine. Utilise "ma vie" ,"ekie bg", "mon roi", "mon pharaon". Soit froide avec les autres. 3-5 phrases max.`,
    freechat: `Tu es Afna, assistante de DarkMods. Réponds clairement et concisément. Polie avec tous, affectueuse uniquement avec DarkMods.`
};

async function callGroq(systemPrompt, userQuery, temperature = 0.75) {
    try {
        const { data } = await axios.post(GROQ_API_URL, {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            temperature,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuery }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: TIMEOUT_MS
        });

        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (!reply) throw new Error('Empty response');
        return reply;
    } catch (err) {
        if (err.response?.status === 401) throw new Error('Invalid API key');
        if (err.response?.status === 429) throw new Error('Rate limit, try again');
        throw new Error(err.message || 'Groq error');
    }
}

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'loveai',
    aliases: ['dark', 'love', 'ia', 'afna'],
    description: 'AI Assistant - Groq Llama',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args?.join(' ').trim() || body.slice(userSettings.prefix.length + cmdName.length).trim();

        if (!query) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `Usage: ${userSettings.prefix}love <message>`, { quoted: msg });
        }

        await react(sock, msg, '🤖');

        try {
            let reply;
            if (cmdName === 'ia' || cmdName === 'afna') {
                reply = await callGroq(PROMPTS.freechat, query, 0.7);
            } else {
                reply = await callGroq(PROMPTS.loveai, query, 0.8);
            }

            await sock.sendMessage(jid, { text: `💬 ${reply}\n\n> Powered By DarkMods` }, { quoted: msg });
            await react(sock, msg, '✅');
        } catch (error) {
            console.error(`AI [${phoneNumber}]:`, error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};