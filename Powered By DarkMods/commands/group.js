import { sendReply } from '../lib/helpers.js';
import Database from '../lib/database.js';

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getTargetUser(msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    if (quoted?.quotedMessage && quoted?.participant) return quoted.participant;
    return quoted?.mentionedJid?.[0] || null;
}

async function checkBotAdmin(sock, jid, msg) {
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const meta = await sock.groupMetadata(jid);
    const botInfo = meta.participants.find(p => p.id === botId);
    if (!botInfo?.admin) {
        await react(sock, msg, '❌');
        await sendReply(sock, jid, `❌ Bot must be admin`, { quoted: msg });
        return false;
    }
    return true;
}

export default {
    name: 'group',
    aliases: [
        'gname', 'gdesc', 'kick', 'add', 'promote', 'demote',
        'purge', 'kickall', 'lock', 'unlock', 'grouplink',
        'antidemote', 'antipromote', 'demoteall', 'autopromote',
        'gcstatus'
    ],
    description: 'Group management commands',
    adminOnly: true,

    async execute({ sock, msg, args, userSettings, groupSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text ||
                     msg.message?.imageMessage?.caption || '';

        const cmdName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
        }

        try {
            switch (cmdName) {
                case 'gname': await handleGroupName(sock, msg, args); break;
                case 'gdesc': await handleGroupDesc(sock, msg, args); break;
                case 'kick': await handleKick(sock, msg); break;
                case 'add': await handleAdd(sock, msg, args); break;
                case 'promote': await handlePromote(sock, msg); break;
                case 'demote': await handleDemote(sock, msg); break;
                case 'purge': await handlePurge(sock, msg); break;
                case 'kickall': await handleKickAll(sock, msg); break;
                case 'lock': await handleLock(sock, msg); break;
                case 'unlock': await handleUnlock(sock, msg); break;
                case 'grouplink': await handleGroupLink(sock, msg); break;
                case 'antidemote': await handleAntiDemote(sock, msg, args, groupSettings); break;
                case 'antipromote': await handleAntiPromote(sock, msg, args, groupSettings); break;
                case 'demoteall': await handleDemoteAll(sock, msg); break;
                case 'autopromote': await handleAutoPromote(sock, msg); break;
                case 'gcstatus': await handleGroupStatus(sock, msg, args); break;
                default:
                    await react(sock, msg, '❌');
                    await sendReply(sock, jid, `❌ Unknown: ${cmdName}`, { quoted: msg });
            }
        } catch (error) {
            console.error(`Group error:`, error.message);
            await react(sock, msg, '❌');
            await sendReply(sock, jid, `❌ ${error.message}`, { quoted: msg });
        }
    }
};

async function handleGroupName(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const newName = args.join(' ');
    if (!newName) {
        return sendReply(sock, jid, `Usage: .gname <new name>`, { quoted: msg });
    }
    await sock.groupUpdateSubject(jid, newName);
    await react(sock, msg, '✅');
}

async function handleGroupDesc(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const newDesc = args.join(' ');
    if (!newDesc) {
        return sendReply(sock, jid, `Usage: .gdesc <description>`, { quoted: msg });
    }
    await sock.groupUpdateDescription(jid, newDesc);
    await react(sock, msg, '✅');
}

async function handleKick(sock, msg) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    if (!target) {
        return sendReply(sock, jid, `Usage: .kick @user or reply`, { quoted: msg });
    }
    await sock.groupParticipantsUpdate(jid, [target], 'remove');
    await react(sock, msg, '✅');
}

async function handleAdd(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const userToAdd = args[0]?.replace(/[^0-9]/g, '');
    if (!userToAdd) {
        return sendReply(sock, jid, `Usage: .add <number>`, { quoted: msg });
    }
    await sock.groupParticipantsUpdate(jid, [`${userToAdd}@s.whatsapp.net`], 'add');
    await react(sock, msg, '✅');
}

async function handlePromote(sock, msg) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    if (!target) {
        return sendReply(sock, jid, `Usage: .promote @user or reply`, { quoted: msg });
    }
    await sock.groupParticipantsUpdate(jid, [target], 'promote');
    await react(sock, msg, '✅');
}

async function handleDemote(sock, msg) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    if (!target) {
        return sendReply(sock, jid, `Usage: .demote @user or reply`, { quoted: msg });
    }
    await sock.groupParticipantsUpdate(jid, [target], 'demote');
    await react(sock, msg, '✅');
}

async function handlePurge(sock, msg) {
    const jid = msg.key.remoteJid;
    if (!await checkBotAdmin(sock, jid, msg)) return;

    await react(sock, msg, '💂');
    const meta = await sock.groupMetadata(jid);
    const members = meta.participants.filter(p => !p.admin).map(p => p.id);

    if (!members.length) {
        return sendReply(sock, jid, `ℹ️ No non-admin members to kick`, { quoted: msg });
    }

    await sock.groupParticipantsUpdate(jid, members, 'remove');
    await react(sock, msg, '✅');
    console.log(`Purge: ${members.length} members kicked`);
}

async function handleKickAll(sock, msg) {
    const jid = msg.key.remoteJid;
    if (!await checkBotAdmin(sock, jid, msg)) return;

    await react(sock, msg, '⚠️');
    const meta = await sock.groupMetadata(jid);
    const members = meta.participants.filter(p => !p.admin).map(p => p.id);

    if (!members.length) {
        return sendReply(sock, jid, `ℹ️ No non-admin members to kick`, { quoted: msg });
    }

    let kicked = 0;
    for (const member of members) {
        try {
            await sock.groupParticipantsUpdate(jid, [member], 'remove');
            kicked++;
            await sleep(1000);
        } catch (err) {}
    }
    await react(sock, msg, '✅');
    console.log(`KickAll: ${kicked}/${members.length} members kicked`);
}

async function handleLock(sock, msg) {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
    await react(sock, msg, '🔒');
}

async function handleUnlock(sock, msg) {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
    await react(sock, msg, '🔓');
}

async function handleGroupLink(sock, msg) {
    const jid = msg.key.remoteJid;
    const code = await sock.groupInviteCode(jid);
    await sendReply(sock, jid, `🔗 Group Link:\nhttps://chat.whatsapp.com/${code}`, { quoted: msg });
}

async function handleAntiDemote(sock, msg, args, groupSettings) {
    const jid = msg.key.remoteJid;
    const action = args[0]?.toLowerCase();
    const current = groupSettings.antidemote_enabled;

    if (!action || action === 'status') {
        await react(sock, msg, current ? '✅' : '❌');
        return sendReply(sock, jid, `🛡️ AntiDemote: ${current ? 'ON' : 'OFF'}`, { quoted: msg });
    }

    const enable = action === 'on';
    await Database.updateGroupSettings(jid, { antidemote_enabled: enable });
    await react(sock, msg, enable ? '✅' : '❌');
    await sendReply(sock, jid, enable ? '🛡️ AntiDemote ON' : '🛡️ AntiDemote OFF', { quoted: null });
}

async function handleAntiPromote(sock, msg, args, groupSettings) {
    const jid = msg.key.remoteJid;
    const action = args[0]?.toLowerCase();
    const current = groupSettings.antipromote_enabled;

    if (!action || action === 'status') {
        await react(sock, msg, current ? '✅' : '❌');
        return sendReply(sock, jid, `🛡️ AntiPromote: ${current ? 'ON' : 'OFF'}`, { quoted: msg });
    }

    const enable = action === 'on';
    await Database.updateGroupSettings(jid, { antipromote_enabled: enable });
    await react(sock, msg, enable ? '✅' : '❌');
    await sendReply(sock, jid, enable ? '🛡️ AntiPromote ON' : '🛡️ AntiPromote OFF', { quoted: null });
}

async function handleDemoteAll(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    await react(sock, msg, '⚰️');
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants.filter(p => p.admin && p.id !== sender).map(p => p.id);

    if (!admins.length) {
        return sendReply(sock, jid, `ℹ️ No other admins to demote`, { quoted: msg });
    }

    await sock.groupParticipantsUpdate(jid, admins, 'demote');
    await react(sock, msg, '✅');
    console.log(`DemoteAll: ${admins.length} admins demoted`);
}

async function handleAutoPromote(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    await react(sock, msg, '🔑');
    await sleep(500);
    await sock.groupParticipantsUpdate(jid, [sender], 'promote');
    await react(sock, msg, '✅');
    console.log(`AutoPromote: ${sender.split('@')[0]}`);
}

// ============================================================
// GCSTATUS - Post a story/status in the group (CORRIGÉ)
// ============================================================
async function handleGroupStatus(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const text = args.join(' ');

    if (!text) {
        return sendReply(sock, jid,
            `╭─「 📱 GCSTATUS 」─────\n` +
            `│ 📌 Usage:\n` +
            `│ .gcstatus <text>\n` +
            `│\n` +
            `│ 💡 Posts a story/status\n` +
            `│ visible to all group members\n` +
            `│\n` +
            `│ 📝 For group description:\n` +
            `│ use .gdesc\n` +
            `╰────────────────────`,
            { quoted: msg }
        );
    }

    await react(sock, msg, '📱');

    try {
        // Envoie un statut texte dans le groupe (apparaît comme une story)
        await sock.sendMessage(jid, {
            text: text,
            mentions: []
        }, {
            statusJidList: [jid]  // ← CLÉ: fait apparaître comme story de groupe
        });

        await react(sock, msg, '✅');
        console.log(`📱 Group status posted in ${jid}`);

    } catch (error) {
        console.error('GCStatus error:', error.message);
        await react(sock, msg, '❌');
        
        // Fallback: envoyer comme message normal
        await sock.sendMessage(jid, {
            text: `📱 GROUP STATUS:\n\n${text}\n\n⚡ Powered By DarkMods 🔮`
        }, { quoted: msg });
    }
};