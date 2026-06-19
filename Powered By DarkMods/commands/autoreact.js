import fs from 'fs';
import path from 'path';
import { sendReply } from '../lib/helpers.js';
import { safeReact } from '../lib/safeSend.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autoreact');

const DEFAULT_EMOJIS = ['❤️', '🔥', '😂', '😍', '👍', '🎉', '🤣', '💀', '🥶', '👀'];

const configPath = () => {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    return path.join(CONFIG_DIR, `${config.owner}.json`);
};

const loadConfig = () => {
    const p = configPath();
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify({ groups: {} }, null, 2));
    return JSON.parse(fs.readFileSync(p));
};

const saveConfig = (data) => fs.writeFileSync(configPath(), JSON.stringify(data, null, 2));

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

export default {
    name: 'autoreact',
    aliases: ['autoreaction'],
    description: 'Auto react to messages in groups',
    usage: 'autoreact <on/off/status/emojis>',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (!jid.endsWith('@g.us')) {
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ Group only`, { quoted: msg });
        }

        if (!action || !['on', 'off', 'status', 'emojis'].includes(action)) {
            return sendReply(sock, jid,
                `╭─「 AUTOREACT 」────\n│ .autoreact on/off\n│ .autoreact status\n│ .autoreact emojis 😂 🔥\n╰────────────────`,
                { quoted: msg }
            );
        }

        try {
            const cfg = loadConfig();
            const groupCfg = cfg.groups[jid] || { enabled: false, emojis: [...DEFAULT_EMOJIS] };

            if (action === 'status') {
                await react(sock, msg, groupCfg.enabled ? '✅' : '❌');
                return sendReply(sock, jid,
                    `╭─「 AUTOREACT 」────\n│ ${groupCfg.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n│ 😀 ${groupCfg.emojis.slice(0, 8).join(' ')}\n╰────────────────`,
                    { quoted: msg }
                );
            }

            if (action === 'emojis') {
                const emojis = args.slice(1);
                if (!emojis.length) {
                    return sendReply(sock, jid, `Usage: .autoreact emojis 😂 🔥`, { quoted: msg });
                }
                groupCfg.emojis = emojis;
                cfg.groups[jid] = groupCfg;
                saveConfig(cfg);
                await react(sock, msg, '✅');
                return sendReply(sock, jid, `✅ Emojis: ${emojis.join(' ')}`, { quoted: msg });
            }

            groupCfg.enabled = action === 'on';
            cfg.groups[jid] = groupCfg;
            saveConfig(cfg);
            await react(sock, msg, groupCfg.enabled ? '✅' : '❌');
            return sendReply(sock, jid, groupCfg.enabled ? '🟢 AutoReact ON' : '🔴 AutoReact OFF', { quoted: msg });

        } catch (err) {
            console.error('AutoReact:', err.message);
            await react(sock, msg, '❌');
            return sendReply(sock, jid, `❌ ${err.message}`, { quoted: msg });
        }
    }
};

export async function handleAutoReact(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        if (!jid.endsWith('@g.us')) return;

        const cfg = loadConfig();
        const groupCfg = cfg.groups[jid];
        if (!groupCfg?.enabled) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        if (text.startsWith('!') || text.startsWith('.') || text.startsWith('/')) return;

        const emoji = groupCfg.emojis[Math.floor(Math.random() * groupCfg.emojis.length)];
        await safeReact(sock, jid, msg, emoji);
    } catch (err) {
        console.error('handleAutoReact:', err.message);
    }
};