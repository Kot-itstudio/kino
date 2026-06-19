import { sendReply, formatError } from '../lib/helpers.js';
import fs from 'fs';
import path from 'path';

const FALLBACK_PIC   = 'https://i.ibb.co/SDd09XR9/425104bcd93b.jpg';
const LOCAL_PIC      = path.join(process.cwd(), 'media', 'menu.jpg');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const getGroupPic = async (sock, jid) => {
    try { return await sock.profilePictureUrl(jid, 'image'); } catch {}
    return FALLBACK_PIC;
};

const buildThumbContext = (groupName, picUrl, picBuffer) => ({
    externalAdReply: {
        title: groupName,
        body: '⚡ Powered By DarkMods',
        mediaType: 1,
        ...(picBuffer ? { thumbnail: picBuffer } : { thumbnailUrl: picUrl }),
        renderLargerThumbnail: true,
        showAdAttribution: false
    }
});

export default {
    name: 'tag',
    aliases: ['tagall', 'hidetag', 'everyone', 'tagadmins', 'tagonline'],
    description: 'Mentionne les membres du groupe',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid,
                formatError('❌ Commande uniquement dans les groupes'),
                { quoted: msg }
            );
        }

        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            await react(sock, msg, '⏳');

            let picUrl = await getGroupPic(sock, jid);
            let picBuffer = undefined;
            if (fs.existsSync(LOCAL_PIC)) {
                picBuffer = fs.readFileSync(LOCAL_PIC);
                picUrl = undefined;
            }

            switch (cmdName) {
                case 'tagall':
                case 'everyone':
                    await tagAll(sock, msg, args, phoneNumber, picUrl, picBuffer);
                    break;
                case 'tagadmins':
                    await tagAdmins(sock, msg, args, phoneNumber, picUrl, picBuffer);
                    break;
                case 'tagonline':
                    await tagOnline(sock, msg, args, phoneNumber, picUrl, picBuffer);
                    break;
                case 'tag':
                case 'hidetag':
                    await hideTag(sock, msg, args, phoneNumber, picUrl, picBuffer);
                    break;
            }

            await react(sock, msg, '✅');
        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur:`, error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

// ══════════════════════════════════════════════════════════════════════════════
//  TAGALL - TOUS LES MEMBRES (1 SEULE PAGE)
// ══════════════════════════════════════════════════════════════════════════════
async function tagAll(sock, msg, args, phoneNumber, picUrl, picBuffer) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const customMessage = args.join(' ').trim();

    const now = new Date();
    const date = now.toLocaleDateString('fr-FR');
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    console.log(`📢 [${phoneNumber}] TagAll → ${participants.length} membres`);

    let text = `❤️ *L O V E - X D - B O T* ❤️\n\n` +
        (customMessage ? `📝 *Message :* ${customMessage}\n\n` : '') +
        `👥 *Total :* ${participants.length} Membres\n` +
        `📅 ${date} • ⏰ ${time}\n\n` +
        `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;

    participants.forEach((p, i) => {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        text += `│ ${isAdmin ? '👑' : '👤'} ${i + 1}. @${p.id.split('@')[0]}\n`;
    });

    text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n⚡ *Powered By DarkMods* ⚡`;

    await sock.sendMessage(jid, {
        text,
        mentions: participants.map(p => p.id),
        contextInfo: buildThumbContext(groupMetadata.subject, picUrl, picBuffer)
    }, { quoted: msg });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAGADMINS - UNIQUEMENT LES ADMINS
// ══════════════════════════════════════════════════════════════════════════════
async function tagAdmins(sock, msg, args, phoneNumber, picUrl, picBuffer) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
    const customMessage = args.join(' ').trim();

    if (admins.length === 0) {
        return sock.sendMessage(jid, { text: '❌ Aucun admin trouvé.', mentions: [] }, { quoted: msg });
    }

    const now = new Date();
    const date = now.toLocaleDateString('fr-FR');
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let text = `👑 *T A G - A D M I N S* 👑\n\n` +
        (customMessage ? `📝 *Message :* ${customMessage}\n\n` : '') +
        `🛡️ *${admins.length} Admin${admins.length > 1 ? 's' : ''}*\n` +
        `📅 ${date} • ⏰ ${time}\n\n` +
        `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;

    admins.forEach((p, i) => {
        const isSuperAdmin = p.admin === 'superadmin';
        text += `│ ${isSuperAdmin ? '💎' : '👑'} ${i + 1}. @${p.id.split('@')[0]}\n`;
    });

    text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n⚡ *Powered By DarkMods* ⚡`;

    await sock.sendMessage(jid, {
        text,
        mentions: admins.map(p => p.id),
        contextInfo: buildThumbContext(groupMetadata.subject, picUrl, picBuffer)
    }, { quoted: msg });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAGONLINE - VERSION ULTRA FIABLE (ACCUSÉS DE LECTURE)
// ══════════════════════════════════════════════════════════════════════════════
async function tagOnline(sock, msg, args, phoneNumber, picUrl, picBuffer) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const customMessage = args.join(' ').trim();

    await react(sock, msg, '📡');
    console.log(`📡 [${phoneNumber}] TagOnline → scan ${participants.length} membres`);

    // Envoi message fantôme
    const ghostMsg = await sock.sendMessage(jid, {
        text: '‎',
        mentions: participants.map(p => p.id)
    });

    await sleep(3000);

    // Capture des accusés
    const readReceipts = new Set();
    const onReceipt = (receipts) => {
        for (const receipt of receipts) {
            if (receipt.key.id === ghostMsg.key.id) {
                receipt.receipts?.forEach(r => {
                    if (r.readTimestamp) readReceipts.add(r.participant || r.jid);
                });
            }
        }
    };

    sock.ev.on('messages.receipt.update', onReceipt);
    await sleep(2000);
    sock.ev.off('messages.receipt.update', onReceipt);

    // Suppression du message fantôme
    try { await sock.sendMessage(jid, { delete: ghostMsg.key }); } catch {}

    const onlineMembers = participants.filter(p => readReceipts.has(p.id));

    console.log(`✅ [${phoneNumber}] TagOnline → ${onlineMembers.length}/${participants.length} en ligne`);

    if (onlineMembers.length === 0) {
        await sock.sendMessage(jid, {
            text: `📡 *T A G - O N L I N E* 📡\n\n┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n│ 😴 Aucun membre en ligne\n└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷`,
            mentions: []
        }, { quoted: msg });
        await react(sock, msg, '😴');
        return;
    }

    const now = new Date();
    const date = now.toLocaleDateString('fr-FR');
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let text = `📡 *T A G - O N L I N E* 📡\n\n` +
        (customMessage ? `📝 *Message :* ${customMessage}\n\n` : '') +
        `🟢 *${onlineMembers.length} Membre${onlineMembers.length > 1 ? 's' : ''} En Ligne*\n` +
        `📅 ${date} • ⏰ ${time}\n\n` +
        `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n`;

    onlineMembers.forEach((p, i) => {
        text += `│ 🟢 ${i + 1}. @${p.id.split('@')[0]}\n`;
    });

    text += `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n⚡ *Powered By DarkMods* ⚡`;

    await sock.sendMessage(jid, {
        text,
        mentions: onlineMembers.map(p => p.id),
        contextInfo: buildThumbContext(groupMetadata.subject, picUrl, picBuffer)
    }, { quoted: msg });

    await react(sock, msg, '✅');
}

// ══════════════════════════════════════════════════════════════════════════════
//  HIDETAG - TAG INVISIBLE
// ══════════════════════════════════════════════════════════════════════════════
async function hideTag(sock, msg, args, phoneNumber, picUrl, picBuffer) {
    const jid = msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(jid);
    const participants = groupMetadata.participants;
    const allMentions = participants.map(p => p.id);

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const senderNum = msg.key.participant?.split('@')[0] || phoneNumber;
    const msgContent = args.join(' ').trim() || quotedText || '🔔 Attention Tous Les Membres !';

    try { await sock.sendMessage(jid, { delete: msg.key }); } catch {}
    await sleep(600);

    const text = `🌟 *LOVE-XD HIDETAG* 🌟\n\n` +
        `✨ *De :* @${senderNum}\n\n` +
        `┌─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n` +
        `│ ${msgContent}\n` +
        `└─⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷⊷\n\n` +
        `👥 *${participants.length} Membres Notifiés* • ⚡ DarkMods`;

    console.log(`🔕 [${phoneNumber}] HideTag → ${participants.length} Membres`);

    await sock.sendMessage(jid, {
        text,
        mentions: allMentions,
        contextInfo: buildThumbContext(groupMetadata.subject, picUrl, picBuffer)
    });
};