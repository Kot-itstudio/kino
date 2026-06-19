import { sendReply } from '../lib/helpers.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import config from '../config.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'vv',
    aliases: ['hey', 'viewonce', 'revealonce'],
    description: 'Reveal view once messages',
    usage: '.vv (reply to a view once message)',

    async execute({ sock, msg }) {
        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        
        // L'utilisateur du bot (owner) - destination des médias révélés
        const ownerJid = `${config.owner}@s.whatsapp.net`;
        
        // Expéditeur du message original
        const senderJid = isGroup ? (msg.key.participant || jid) : jid;
        const senderName = senderJid.split('@')[0];

        // Supprimer la commande dans le groupe
        if (isGroup) {
            try {
                await sock.sendMessage(jid, { delete: msg.key });
            } catch (_) {}
        }

        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMessage) {
            if (isGroup) await react(sock, msg, '❌');
            await sock.sendMessage(ownerJid, {
                text: `╭─「 🔓 VUE UNIQUE 」────\n│ ❌ No quoted message\n│\n│ 📌 Usage: Reply to a\n│ view once message with .vv\n╰────────────────────`
            });
            return;
        }

        const quotedImage = quotedMessage.imageMessage;
        const quotedVideo = quotedMessage.videoMessage;

        const downloadMedia = async (mediaMsg, type) => {
            const stream = await downloadContentFromMessage(mediaMsg, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length === 0) throw new Error('Empty buffer');
            return buffer;
        };

        const now = new Date().toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        try {
            // ── IMAGE ──────────────────────────────────────────────────────
            if (quotedImage?.viewOnce) {
                console.log(`🔓 VIEW ONCE → IMAGE from ${senderName}`);
                
                const buffer = await downloadMedia(quotedImage, 'image');

                const caption = 
                    `╭─「 🔓 VUE UNIQUE 」────\n` +
                    `│ 📸 Type: Image\n` +
                    `│ 👤 De: @${senderName}\n` +
                    `│ 📍 Lieu: ${isGroup ? 'GROUPE' : 'PRIVE'}\n` +
                    `│ 🕒 Date: ${now}\n` +
                    `${quotedImage.caption ? `│ 📝 Légende: ${quotedImage.caption}\n` : ''}` +
                    `│\n` +
                    `│ ⚡ Powered By DarkMods 🔮\n` +
                    `╰────────────────────`;

                await sock.sendMessage(ownerJid, {
                    image: buffer,
                    caption,
                    mentions: [senderJid]
                });

                if (isGroup) await react(sock, msg, '✅');
                console.log(`✅ Image sent to owner from ${senderName}`);
                return;
            }

            // ── VIDÉO ──────────────────────────────────────────────────────
            if (quotedVideo?.viewOnce) {
                console.log(`🔓 VIEW ONCE → VIDEO from ${senderName}`);
                
                const buffer = await downloadMedia(quotedVideo, 'video');

                const caption = 
                    `╭─「 🔓 VUE UNIQUE 」────\n` +
                    `│ 🎥 Type: Video\n` +
                    `│ 👤 De: @${senderName}\n` +
                    `│ 📍 Lieu: ${isGroup ? 'GROUPE' : 'PRIVE'}\n` +
                    `│ 🕒 Date: ${now}\n` +
                    `${quotedVideo.caption ? `│ 📝 Légende: ${quotedVideo.caption}\n` : ''}` +
                    `│\n` +
                    `│ ⚡ Powered By DarkMods 🔮\n` +
                    `╰────────────────────`;

                await sock.sendMessage(ownerJid, {
                    video: buffer,
                    caption,
                    mentions: [senderJid]
                });

                if (isGroup) await react(sock, msg, '✅');
                console.log(`✅ Video sent to owner from ${senderName}`);
                return;
            }

            // ── Pas un view once ───────────────────────────────────────────
            if (isGroup) await react(sock, msg, '❌');
            await sock.sendMessage(ownerJid, {
                text: `╭─「 🔓 VUE UNIQUE 」────\n│ ❌ Not a view once message\n│ 👤 From: @${senderName}\n╰────────────────────`,
                mentions: [senderJid]
            });

        } catch (error) {
            console.error('VV Error:', error.message);

            const detail = error.message.includes('Empty buffer') ? 'Download failed'
                          : error.message.includes('not found') ? 'Message expired'
                          : error.message;

            await sock.sendMessage(ownerJid, {
                text: `╭─「 🔓 VUE UNIQUE 」────\n│ ❌ Error: ${detail}\n│ 👤 From: @${senderName}\n╰────────────────────`,
                mentions: [senderJid]
            });

            if (isGroup) await react(sock, msg, '❌');
        }
    }
};