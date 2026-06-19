import fs from 'fs';
import path from 'path';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import { safePresence } from '../lib/safeSend.js';
import Database from '../lib/database.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autowrite');

function getUserConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    
    if (!fs.existsSync(userConfigPath)) {
        fs.writeFileSync(userConfigPath, JSON.stringify({ enabled: false }, null, 2));
    }
    
    return JSON.parse(fs.readFileSync(userConfigPath));
}

function saveUserConfig(configData) {
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    fs.writeFileSync(userConfigPath, JSON.stringify(configData, null, 2));
}

export default {
    name: 'autowrite',
    aliases: ['autotype', 'fakewrite'],
    description: 'Enable/disable automatic typing simulation',
    usage: 'autowrite <on/off/status>',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'status'].includes(action)) {
            return sendReply(sock, jid, formatError('Usage: autowrite <on/off/status>'), { quoted: msg });
        }

        const config = getUserConfig();

        if (action === 'status') {
            return sendReply(sock, jid, `✍️ Autowrite: ${config.enabled ? 'ON' : 'OFF'}`, { quoted: msg });
        }

        const shouldEnable = action === 'on';
        
        if (config.enabled === shouldEnable) {
            return sendReply(sock, jid, formatError(`Already ${shouldEnable ? 'ON' : 'OFF'}`), { quoted: msg });
        }

        config.enabled = shouldEnable;
        saveUserConfig(config);
        sendReply(sock, jid, formatSuccess(`Autowrite ${shouldEnable ? 'ON' : 'OFF'}`), { quoted: msg });
    }
};

export async function handleAutowriteMessage(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        
        if (!jid || jid === 'status@broadcast' || msg.key.fromMe) return;
        
        const config = getUserConfig();
        if (!config.enabled) return;

        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const userSettings = await Database.getUserSettings();
        
        if (body.startsWith(userSettings.prefix)) return;

        await safePresence(sock, jid, 'composing');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await safePresence(sock, jid, 'paused');
    } catch (error) {}
};