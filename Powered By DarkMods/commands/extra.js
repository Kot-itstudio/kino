import { sendReply } from '../lib/helpers.js';
import axios from 'axios';
import config from '../config.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

// Nouvelle API Ryuu
const RYUU_API = 'https://api.ryuu-dev.my.id';
const RYUU_APIKEY = 'ryuu-apis-f38a9c62ea67450d1778917305464';

async function getRyuu(endpoint, params = {}) {
    const res = await axios.get(`${RYUU_API}${endpoint}`, {
        params,
        timeout: 30000,
        headers: { 'X-RYUU-APIKEY': RYUU_APIKEY }
    });
    return res.data;
}

const VERITES = [
    "What's the most embarrassing thing you've done in public?",
    "Have you ever lied to someone you love?",
    "What's your biggest secret?",
    "Have you ever had a crush on someone in this group?",
    "What's the craziest thing you've done for love?"
];

const ACTIONS = [
    "Do 20 pushups right now",
    "Send a voice note singing for 10 seconds",
    "Compliment every member of this group",
    "Imitate an animal in a voice note",
    "Tell a joke to the group"
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default {
    name: 'extra',
    aliases: ['avk', 'owner', 'tiktok', 'tt', 'facebook', 'fb', 'pinterest', 'pin'],
    description: 'Action/Truth, Owner, TikTok, Facebook, Pinterest',

    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            switch (cmdName) {
                case 'avk': await handleAVK(sock, msg); break;
                case 'owner': await handleOwner(sock, msg); break;
                case 'tiktok':
                case 'tt': await handleTikTok(sock, msg, args); break;
                case 'facebook':
                case 'fb': await handleFacebook(sock, msg, args); break;
                case 'pinterest':
                case 'pin': await handlePinterest(sock, msg, args); break;
                default: await react(sock, msg, '❓');
            }
        } catch (error) {
            console.error('Extra error:', error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};

async function handleAVK(sock, msg) {
    const jid = msg.key.remoteJid;
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedPart = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const targetJid = mentionedJid || quotedPart;

    if (!targetJid) {
        await react(sock, msg, 'ℹ️');
        return sendReply(sock, jid, `Usage: .avk @user or reply to their message`, { quoted: msg });
    }

    const isAction = Math.random() < 0.5;
    const challenge = isAction ? pick(ACTIONS) : pick(VERITES);
    const type = isAction ? '⚡ ACTION' : '💬 TRUTH';

    await react(sock, msg, '🎭');
    await sendReply(sock, jid, `🎭 ${type} for @${targetJid.split('@')[0]}\n\n_${challenge}_`, { quoted: msg, mentions: [targetJid] });
}

async function handleOwner(sock, msg) {
    const jid = msg.key.remoteJid;
    const ownerNumber = config.owner?.replace(/[^0-9]/g, '') || '';
    const ownerName = config.ownerName || 'DarkMods';

    if (!ownerNumber) {
        await react(sock, msg, '❌');
        return sendReply(sock, jid, `❌ Owner not configured`, { quoted: msg });
    }

    await react(sock, msg, '👑');
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\nORG:DarkMods;\nTEL;type=CELL;waid=${ownerNumber}:+${ownerNumber}\nEND:VCARD`;

    await sock.sendMessage(jid, { contacts: { displayName: ownerName, contacts: [{ vcard }] } }, { quoted: msg });
    await react(sock, msg, '✅');
}

// ==================== TIKTOK AVEC API RYUU ====================
async function handleTikTok(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const url = args[0];

    if (!url || !url.includes('tiktok.com')) {
        return sendReply(sock, jid, `╭─「 🎵 TIKTOK 」─────\n│ 📌 Usage: .tiktok <url>\n╰────────────────────`, { quoted: msg });
    }

    await react(sock, msg, '⏳');

    try {
        const data = await getRyuu('/downloader/tiktok', { url });

        if (!data?.status || !data?.result) {
            throw new Error('No data from API');
        }

        const result = data.result;
        const videoUrl = result.video || result.play || result.nowm;
        const title = result.title || result.desc || 'TikTok Video';
        const author = result.author?.nickname || result.author?.username || 'Unknown';

        if (!videoUrl) {
            throw new Error('No video URL found');
        }

        await sock.sendMessage(jid, {
            video: { url: videoUrl },
            caption: `╭─「 🎵 *TIKTOK* 」─────\n│ 📀 ${title}\n│ 👤 @${author}\n│\n│ ⚡ Powered By DarkMods 🔮\n╰────────────────────`,
            mentions: []
        }, { quoted: msg });

        await react(sock, msg, '✅');

    } catch (error) {
        console.error('TikTok error:', error.message);
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ Failed: ${error.message}`, { quoted: msg });
    }
}

// ==================== FACEBOOK AVEC API RYUU ====================
async function handleFacebook(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const url = args[0];

    if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
        return sendReply(sock, jid, `╭─「 📘 FACEBOOK 」────\n│ 📌 Usage: .facebook <url>\n╰────────────────────`, { quoted: msg });
    }

    await react(sock, msg, '⏳');

    try {
        const data = await getRyuu('/downloader/facebook', { url });

        if (!data?.status || !data?.result) {
            throw new Error('No data from API');
        }

        const result = data.result;
        const videoUrl = result.hd || result.sd || result.url;
        const title = result.title || 'Facebook Video';

        if (!videoUrl) {
            throw new Error('No video URL found');
        }

        await sock.sendMessage(jid, {
            video: { url: videoUrl },
            caption: `╭─「 📘 *FACEBOOK* 」───\n│ 📀 ${title}\n│\n│ ⚡ Powered By DarkMods 🔮\n╰────────────────────`
        }, { quoted: msg });

        await react(sock, msg, '✅');

    } catch (error) {
        console.error('Facebook error:', error.message);
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ Failed: ${error.message}`, { quoted: msg });
    }
}

// ==================== PINTEREST AVEC API RYUU ====================
async function handlePinterest(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const input = args.join(' ');
    const isLink = input?.startsWith('http') && (input.includes('pinterest') || input.includes('pin.it'));

    if (!input) {
        return sendReply(sock, jid, `╭─「 📌 PINTEREST 」───\n│ 📌 Usage: .pinterest <search or url>\n│\n│ 💡 Examples:\n│ .pinterest anime girl\n│ .pinterest https://pin.it/xxx\n╰────────────────────`, { quoted: msg });
    }

    await react(sock, msg, '⏳');

    try {
        // Mode recherche (mot-clé)
        if (!isLink) {
            const data = await getRyuu('/search/pinterest', { q: input });

            if (!data?.status || !data?.result?.length) {
                throw new Error(`No results for "${input}"`);
            }

            const images = data.result.slice(0, 3);
            for (const img of images) {
                const imgUrl = img.image || img.url;
                if (imgUrl) {
                    await sock.sendMessage(jid, {
                        image: { url: imgUrl },
                        caption: `📌 ${input}\n\n⚡ Powered By DarkMods 🔮`
                    });
                }
            }
            await react(sock, msg, '✅');
            return;
        }

        // Mode lien Pinterest
        const data = await getRyuu('/downloader/pinterest', { url: input });

        if (!data?.status || !data?.result) {
            throw new Error('No media found');
        }

        const result = data.result;
        const mediaUrl = result.url || result.video || result.image;
        const isVideo = result.type === 'video' || result.video;

        if (!mediaUrl) {
            throw new Error('No media URL found');
        }

        if (isVideo) {
            await sock.sendMessage(jid, {
                video: { url: mediaUrl },
                caption: `╭─「 📌 *PINTEREST* 」──\n│ 🎬 Video\n│\n│ ⚡ Powered By DarkMods 🔮\n╰────────────────────`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(jid, {
                image: { url: mediaUrl },
                caption: `╭─「 📌 *PINTEREST* 」──\n│ 🖼️ Image\n│\n│ ⚡ Powered By DarkMods 🔮\n╰────────────────────`
            }, { quoted: msg });
        }
        await react(sock, msg, '✅');

    } catch (error) {
        console.error('Pinterest error:', error.message);
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
    }
};