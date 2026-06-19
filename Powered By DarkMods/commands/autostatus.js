import fs from 'fs';
import path from 'path';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autostatus');

const react = (sock, msg, emoji) =>
    sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

const configPath = () => {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    return path.join(CONFIG_DIR, `${config.owner}.json`);
};

const loadConfig = () => {
    const p = configPath();
    if (!fs.existsSync(p)) {
        fs.writeFileSync(p, JSON.stringify({ 
            viewEnabled: false, 
            reactEnabled: false, 
            reactEmoji: '❤️' 
        }, null, 2));
    }
    return JSON.parse(fs.readFileSync(p));
};

const saveConfig = (data) => fs.writeFileSync(configPath(), JSON.stringify(data, null, 2));

export default {
    name: 'autostatus',
    aliases: ['autostatusview', 'autostatusreact'],
    description: 'Auto view and react to statuses',
    usage: 'autostatus <view/react/status> <on/off> [emoji]',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();
        const subAction = args[1]?.toLowerCase();

        if (!action || !['view', 'react', 'status'].includes(action)) {
            return sendReply(sock, jid,
                `╭─「 AUTOSTATUS 」────\n│ .autostatus status\n│ .autostatus view on/off\n│ .autostatus react on/off\n│ .autostatus react emoji 🎉\n╰──────────────────`,
                { quoted: msg }
            );
        }

        const cfg = loadConfig();

        if (action === 'status') {
            return sendReply(sock, jid,
                `╭─「 AUTOSTATUS 」────\n│ 👁️ View: ${cfg.viewEnabled ? '🟢 ON' : '🔴 OFF'}\n│ 💬 React: ${cfg.reactEnabled ? '🟢 ON' : '🔴 OFF'}\n│ 😀 Emoji: ${cfg.reactEmoji}\n╰──────────────────`,
                { quoted: msg }
            );
        }

        if (action === 'view') {
            if (!subAction || !['on', 'off'].includes(subAction)) {
                return sendReply(sock, jid, `Usage: .autostatus view on/off`, { quoted: msg });
            }
            cfg.viewEnabled = subAction === 'on';
            saveConfig(cfg);
            await react(sock, msg, cfg.viewEnabled ? '✅' : '❌');
            return sendReply(sock, jid, `👁️ View ${cfg.viewEnabled ? 'ON' : 'OFF'}`, { quoted: msg });
        }

        if (action === 'react') {
            if (subAction === 'emoji') {
                const newEmoji = args[2];
                if (!newEmoji) return sendReply(sock, jid, `Usage: .autostatus react emoji 🎉`, { quoted: msg });
                cfg.reactEmoji = newEmoji;
                saveConfig(cfg);
                await react(sock, msg, newEmoji);
                return sendReply(sock, jid, `😀 Emoji: ${newEmoji}`, { quoted: msg });
            }

            if (!subAction || !['on', 'off'].includes(subAction)) {
                return sendReply(sock, jid, `Usage: .autostatus react on/off`, { quoted: msg });
            }

            cfg.reactEnabled = subAction === 'on';
            saveConfig(cfg);
            await react(sock, msg, cfg.reactEnabled ? '✅' : '❌');
            return sendReply(sock, jid, `💬 React ${cfg.reactEnabled ? 'ON' : 'OFF'}`, { quoted: msg });
        }
    }
};

export async function handleAutoStatus(sock, status) {
    try {
        const cfg = loadConfig();
        if (!cfg.viewEnabled && !cfg.reactEnabled) return;

        await new Promise(r => setTimeout(r, 800));

        const key = status.messages?.[0]?.key || (status.key?.remoteJid === 'status@broadcast' ? status.key : null);
        if (!key) return;

        if (cfg.viewEnabled) await sock.readMessages([key]).catch(() => {});
        if (cfg.reactEnabled) await reactToStatus(sock, key, cfg.reactEmoji);
    } catch (err) {
        console.error('handleAutoStatus:', err.message);
    }
}

async function reactToStatus(sock, statusKey, emoji) {
    try {
        await sock.relayMessage('status@broadcast', {
            reactionMessage: {
                key: {
                    remoteJid: 'status@broadcast',
                    id: statusKey.id,
                    participant: statusKey.participant || statusKey.remoteJid,
                    fromMe: false
                },
                text: emoji
            }
        }, {
            messageId: statusKey.id,
            statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
        });
    } catch (err) {
        console.error('reactToStatus:', err.message);
    }
};