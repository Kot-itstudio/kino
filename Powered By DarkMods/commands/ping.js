import { sendReply } from '../lib/helpers.js';

const LATENCY_LEVELS = [
    { 
        max: 500, 
        emoji: '⚡', 
        label: 'Excellent', 
        url: 'https://i.ibb.co/Kpbr4THX/1fec769ad111.jpg'
    },
    { 
        max: 1000, 
        emoji: '📡', 
        label: 'Bon', 
        url: 'https://i.ibb.co/q3hChCy7/d4e1c4e2bcd9.jpg'
    },
    { 
        max: 2000, 
        emoji: '🐢', 
        label: 'Lent', 
        url: 'https://i.ibb.co/PGBG31r2/13e2df93115e.jpg'
    },
    { 
        max: Infinity, 
        emoji: '😴', 
        label: 'Très lent', 
        url: 'https://i.ibb.co/60hvKsvD/f1f2b0182d55.jpg'
    }
];

const getLevel = (ms) => LATENCY_LEVELS.find(l => ms <= l.max);

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'ping',
    description: 'Check bot latency with image',

    async execute({ sock, msg }) {
        const jid = msg.key.remoteJid;
        const start = Date.now();

        await react(sock, msg, '🏓');

        const ms = Date.now() - start;
        const level = getLevel(ms);

        const caption = 
            `╭─「 🏓 *P O N G* 🇦🇱 」──────────\n` +
            `│\n` +
            `│ ${level.emoji} *Latence :* ${ms}ms\n` +
            `│ 🇦🇱 *État :* ${level.label}\n` +
            `│\n` +
            `│ 🇦🇱 *Stay Freaky & Stay Bloody*\n` +
            `│\n` +
            `│ 🇦🇱 *Powered By DarkMods* \n` +
            `╰────────────────────────`;

        try {
            await sock.sendMessage(jid, {
                image: { url: level.url },
                caption: caption,
                mimetype: 'image/jpeg'
            }, { quoted: msg });

            await react(sock, msg, '✅');

        } catch (err) {
            console.error('Ping error:', err.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, caption, { quoted: msg });
        }
    }
};