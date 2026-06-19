import { font } from '../lib/helpers.js';
import fs from 'fs';
import path from 'path';

const gifPath   = path.join(process.cwd(), 'media', 'menu.mp4');
const thumbPath = path.join(process.cwd(), 'media', 'menu.jpg');
const audioPath = path.join(process.cwd(), 'media', 'menu.mp3');

export default {
    name: 'menu',
    aliases: ['menu', 'list'],
    description: 'affiche tous les commandes disponibles',

    async execute({ sock, msg, phoneNumber, userSettings }) {
        const jid       = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;

        const menuText =
`
> ┏━✰━━━━━━━━━━━━━━━━━✰━┓
>   ☆☆☆ 𝐋𝐎𝐕𝐄 - 𝐗 𝐃 - 𝐁𝐎𝐓 ☆☆☆
> ┗━✰━━━━━━━━━━━━━━━━━✰━┛
> ━━━━━━━━━━━━━━━━━✰
> ┏━━━━━━━━━━━━━━━━━✰
> ┃ ✦ 𝐏𝐞𝐫𝐬𝐨𝐧𝐧𝐢𝐟𝐢𝐜𝐚𝐭𝐢𝐨𝐧 𝐎𝐟 𝐌𝐲 𝐐𝐮𝐞𝐞𝐧
> ┃ ✦ 𝐂𝐫𝐞𝐚𝐭𝐨𝐫 : 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬⁰⁰⁷
> ┠ ✦ 𝐍𝐚𝐦𝐞 : ${userSettings.bot_name}
> ┠ ✦ 𝐏𝐫𝐞𝐟𝐢𝐱𝐞 : ${userSettings.prefix}
> ┠ ✦ 𝐕𝐞𝐫𝐬𝐢𝐨𝐧 : 2.0.0
> ┗━━━━━━━━━━━━━━━━━━━━━━✰
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐆𝐄𝐍𝐄𝐑𝐀𝐋 𝐓𝐎𝐎𝐋𝐒 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .menu
> ┠ ✧ .setname
> ┠ ✧ .setprefix
> ┠ ✧ .alive
> ┠ ✧ .ping
> ┠ ✧ .private
> ┠ ✧ .public
> ┠ ✧ .sudo
> ┠ ✧ .delsudo
> ┠ ✧ .sudolist
> ┠ ✧ .owner
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐀𝐑𝐓𝐈𝐅𝐈𝐂𝐈𝐀𝐋 𝐈𝐍𝐓𝐄𝐋𝐋𝐈𝐆𝐄𝐍𝐂𝐄 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .love
> ┠ ✧ .avk (a ou v)
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐏𝐑𝐎𝐓𝐄𝐂𝐓𝐈𝐎𝐍𝐒 𝐀𝐑𝐄𝐍𝐀 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .antimention
> ┠ ✧ .antilink
> ┠ ✧ .antispam
> ┠ ✧ .antitag
> ┠ ✧ .autoreact
> ┠ ✧ .autostatus
> ┠ ✧ .autowrite
> ┠ ✧ .antidelete
> ┠ ✧ .hey (vv)
> ┠ ✧ .save
> ┠ ✧ .welcome
> ┠ ✧ .goodbye
> ┠ ✧ .idch
> ┠ ✧ .warnings
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐌𝐄𝐃𝐈𝐀 𝐔𝐋𝐓𝐑𝐀 𝐂𝐎𝐑𝐄 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .store
> ┠ ✧ .ad
> ┠ ✧ .vd
> ┠ ✧ .list
> ┠ ✧ .sticker
> ┠ ✧ .getpp
> ┠ ✧ .setpp
> ┠ ✧ .toimg
> ┠ ✧ .tovid
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐆𝐑𝐎𝐔𝐏𝐒 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .gname
> ┠ ✧ .gdesc
> ┠ ✧ .gcstatus
> ┠ ✧ .kick
> ┠ ✧ .add
> ┠ ✧ .promote
> ┠ ✧ .demote
> ┠ ✧ .purge
> ┠ ✧ .tagall
> ┠ ✧ .tagadmins
> ┠ ✧ .tagonline
> ┠ ✧ .hidetag
> ┠ ✧ .jid
> ┠ ✧ .kickall
> ┠ ✧ .lock
> ┠ ✧ .unlock
> ┠ ✧ .grouplink
> ┠ ✧ .antidemote
> ┠ ✧ .antipromote
> ┠ ✧ .demoteall
> ┠ ✧ .autopromote
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .tg
> ┠ ✧ .fb
> ┠ ✧ .pin
> ┠ ✧ .tt
> ┠ ✧ .play
> ┠ ✧ .ytmp3
> ┠ ✧ .ytmp4
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ◈ 𝐓𝐎𝐎𝐋𝐒 𝐗 𝐓𝐎𝐎𝐋𝐒 ◈
> ┏━━━━━━━━━━━━━◈
> ┠ ✧ .fancy
> ┠ ✧ .encrypt
> ┠ ✧ .encrypt2
> ┠ ✧ .tempmail
> ┠ ✧ .settag
> ┠ ✧ .cleartag
> ┠ ✧ .mytag
> ┠ ✧ .getmail
> ┗━━━━━━━━━━━━━━━━━━━━━◈
> ━━━━━━━━━━━━━━━━━✰
> ┏━━━━━━━━━━━━━━━━━━━━━━✰
> ┃ 𝐓𝐡𝐞 𝐋𝐨𝐯𝐞 𝐎𝐟 𝐘𝐨𝐮𝐫 𝐋𝐢𝐟𝐞 𝐈𝐬 𝐘𝐨𝐮
> ┃ 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬-𝐍𝐞𝐦𝐞𝐬𝐢𝐬⁰⁰⁷
> ┗━━━━━━━━━━━━━━━━━━━━━━✰`;

        try {
            const finalMenu   = font ? font(menuText) : menuText;
            const thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : undefined;
            const gifBuffer   = fs.existsSync(gifPath)   ? fs.readFileSync(gifPath)   : null;

            if (!gifBuffer) {
                throw new Error('media/menu.mp4 introuvable');
            }

            await sock.sendMessage(jid, { react: { text: '❤️', key: msg.key } });

            await sock.sendMessage(jid, {
                video:       gifBuffer,
                caption:     finalMenu,
                gifPlayback: true,
                mimetype:    'video/mp4',
                contextInfo: {
                    forwardedNewsletterMessageInfo: {
                        newsletterJid:   '120363407296764591@newsletter',
                        newsletterName:  '𝗟 𝗢 𝗩 𝗘 - 𝗫 𝗗 - 𝗕 𝗢 𝗧',
                        serverMessageId: 1
                    },
                    isForwarded:     true,
                    forwardingScore: 999,
                    externalAdReply: {
                        showAdAttribution:     false,
                        title:                 `𝐋 𝐎 𝐕 𝐄 - 𝐗 𝐃 - 𝐁 𝐎 𝐓`,
                        body:                  `𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬⁰⁰⁷`,
                        mediaType:             1,
                        thumbnail:             thumbBuffer,
                        renderLargerThumbnail: false,
                        sourceUrl:             'https://wa.me/2349052076139'
                    },
                    mentionedJid: [senderJid]
                }
            });

            console.log(`✅ [${phoneNumber}] Menu envoyé`);

            if (fs.existsSync(audioPath)) {
                await new Promise(r => setTimeout(r, 800));
                await sock.sendMessage(jid, {
                    audio:    fs.readFileSync(audioPath),
                    mimetype: 'audio/mpeg',
                    ptt:      false
                });
            }

        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur menu:`, error.message);
            try {
                const thumbBuffer = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : undefined;
                await sock.sendMessage(jid, {
                    text:        font ? font(menuText) : menuText,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded:     true,
                        externalAdReply: {
                            showAdAttribution:     false,
                            title:                 `𝐋 𝐎 𝐕 𝐄 - 𝐗 𝐃 - 𝐁 𝐎 𝐓`,
                            body:                  `𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐃𝐚𝐫𝐤𝐌𝐨𝐝𝐬⁰⁰⁷`,
                            mediaType:             3,
                            thumbnail:             thumbBuffer,
                            renderLargerThumbnail: false,
                            sourceUrl:             'https://wa.me/2349052076139'
                        }
                    }
                });
            } catch {
                await sock.sendMessage(jid, { text: '❌ Erreur lors de l\'affichage du menu.' });
            }
        }
    }
};