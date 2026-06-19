import { sendReply } from '../lib/helpers.js';

const IMAGE_URL = 'https://i.ibb.co/p6qWDZ7c/b4b16174fb10.jpg';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const formatUptime = () => {
    const u = process.uptime();
    const hrs = Math.floor(u / 3600);
    const mins = Math.floor((u % 3600) / 60);
    const secs = Math.floor(u % 60);
    return `${hrs}h ${mins}m ${secs}s`;
};

export default {
    name: 'alive',
    aliases: ['status', 'runtime'],
    description: 'Check bot status',

    async execute({ sock, msg }) {
        const jid = msg.key.remoteJid;

        const caption = `🇦🇱 *LOVE-XD-BOT* 🇦🇱\n\n🟢 *Status*: *ACTIVE*\n⏱️ *Uptime: ${formatUptime()}\n🇦🇱 *Latency*: ${Date.now() % 100}*ms*\n\n🇦🇱 *Powered By DarkMods*`;

        try {
            await react(sock, msg, '❤️');
            await sock.sendMessage(jid, { image: { url: IMAGE_URL }, caption }, { quoted: msg });
            await react(sock, msg, '✅');
        } catch (error) {
            console.error('Alive:', error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `🟢 Bot ACTIVE\n⏱️ Uptime: ${formatUptime()}`, { quoted: msg });
        }
    }
};