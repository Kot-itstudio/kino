import NodeCache from 'node-cache';
import Database from './database.js';
import sudoManager from './sudoManager.js';
import config from '../config.js';

// Cache pour les métadonnées des groupes (expire après 30 minutes)
const groupMetadataCache = new NodeCache({ stdTTL: 1800 });
const pendingRequests = new Map();
const rateLimitCache = new NodeCache({ stdTTL: 60 });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getGroupMetadataWithCache(sock, chatId) {
    try {
        if (!sock || typeof sock.groupMetadata !== 'function') {
            throw new Error('Invalid sock object');
        }

        const cached = groupMetadataCache.get(chatId);
        if (cached) return cached;

        if (pendingRequests.has(chatId)) {
            return await pendingRequests.get(chatId);
        }

        const requestCount = rateLimitCache.get(chatId) || 0;
        if (requestCount > 5) {
            const backoffTime = Math.min(1000 * (requestCount - 5), 30000);
            await wait(backoffTime);
        }

        const requestPromise = (async () => {
            try {
                rateLimitCache.set(chatId, requestCount + 1);
                const metadata = await sock.groupMetadata(chatId);
                groupMetadataCache.set(chatId, metadata);
                return metadata;
            } catch (error) {
                if (error.status === 429 || error.data === 429 || error.output?.statusCode === 429) {
                    await wait(5000);
                    const metadata = await sock.groupMetadata(chatId);
                    groupMetadataCache.set(chatId, metadata);
                    return metadata;
                }
                const cachedData = groupMetadataCache.get(chatId);
                if (cachedData) {
                    console.log('⚠️ API error, using cached metadata for:', chatId);
                    return cachedData;
                }
                throw error;
            }
        })();

        pendingRequests.set(chatId, requestPromise);
        const result = await requestPromise;
        pendingRequests.delete(chatId);
        return result;
    } catch (error) {
        console.error('❌ Error getting group metadata:', error.message);
        throw error;
    }
}

const getParticipantInfo = async (sock, chatId, userIdentifier) => {
    try {
        const groupMetadata = await getGroupMetadataWithCache(sock, chatId);
        const participants = groupMetadata.participants || [];
        const participant = participants.find(p => {
            const ids = [p.id, p.lid, p.jid].filter(Boolean);
            return ids.some(id => 
                id === userIdentifier ||
                (typeof userIdentifier === 'string' && id && id.includes(userIdentifier.split('@')[0]))
            );
        });
        return participant || {};
    } catch (error) {
        console.error('❌ Error getting participant info:', error.message);
        return {};
    }
};

async function isAdmin(sock, jid, user) {
    try {
        if (!sock || !jid || !user) return false;
        
        const participantInfo = await getParticipantInfo(sock, jid, user);
        if (participantInfo && participantInfo.admin) {
            return true;
        }

        const metadata = await getGroupMetadataWithCache(sock, jid);
        const participants = metadata.participants || [];
        
        const userNumber = user.split('@')[0];
        
        const participant = participants.find(p => {
            const participantId = p.id || '';
            const participantLid = p.lid || '';
            const participantJid = p.jid || '';
            return p.id === user ||
                   p.lid === user ||
                   p.jid === user ||
                   participantId.includes(userNumber) ||
                   participantLid.includes(userNumber) ||
                   participantJid.includes(userNumber);
        });

        if (participant) {
            return !!participant.admin;
        }
        return false;
    } catch (error) {
        console.error("❌ Error in isAdmin function:", error.message);
        return false;
    }
}

function isOwner(msg) {
    if (!msg || !msg.key) return false;
    if (msg.key.fromMe) return true;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return false;
    
    const senderNumber = sender.split('@')[0].split(':')[0];

    const isPrivateChat = msg.key.remoteJid && msg.key.remoteJid.endsWith('@s.whatsapp.net');
    
    if (isPrivateChat) {
        const remoteJidNumber = msg.key.remoteJid.split('@')[0];
        return remoteJidNumber === config.owner;
    } else {
        return senderNumber === config.owner;
    }
}

async function isPremium(userJid) {
    try {
        if (!userJid) return false;
        if (!Database || typeof Database.isPremiumUser !== 'function') {
            console.error('❌ Database.isPremiumUser not available');
            return false;
        }
        return await Database.isPremiumUser(userJid);
    } catch (error) {
        console.error('❌ Error checking premium status:', error.message);
        return false;
    }
}

function isSudoUser(userJid) {
    try {
        if (!userJid) return false;
        if (!sudoManager || typeof sudoManager.isSudoUser !== 'function') {
            console.error('❌ sudoManager.isSudoUser not available');
            return false;
        }
        return sudoManager.isSudoUser(userJid);
    } catch (error) {
        console.error('❌ Error checking sudo status:', error.message);
        return false;
    }
}

function canUseInPrivateMode(msg) {
    if (!msg || !msg.key) return false;
    if (isOwner(msg)) return true;
    const sender = msg.key.participant || msg.key.remoteJid;
    if (!sender) return false;
    return isSudoUser(sender);
}

async function checkPermissions({ sock, msg, userSettings, commandName }) {
    if (!msg || !msg.key) {
        console.error('❌ checkPermissions: invalid msg object');
        return { allowed: false, reason: 'INVALID_MESSAGE' };
    }
    
    const jid = msg.key.remoteJid;
    if (!jid) {
        console.error('❌ checkPermissions: missing remoteJid');
        return { allowed: false, reason: 'INVALID_JID' };
    }
    
    const sender = msg.key.participant || jid;
    const isGroup = jid.endsWith('@g.us');

    try {
        const mode = userSettings?.bot_mode || 'public';
        if (mode === 'private') {
            if (!canUseInPrivateMode(msg)) {
                return { allowed: false, reason: 'ACCESS_DENIED', silent: true };
            }
        }

        const ownerCommands = ['setprefix', 'setname', 'private', 'public', 'sudo', 'addsudo', 'makesudo', 'delsudo', 'removesudo', 'unsudo'];
        if (ownerCommands.includes(commandName) && !isOwner(msg)) {
            return { allowed: false, reason: 'OWNER_ONLY' };
        }

        const premiumCommands = ['broadcast', 'autoreply', 'backup', 'restore', 'stats'];
        if (premiumCommands.includes(commandName)) {
            const userIsPremium = await isPremium(sender);
            if (!userIsPremium) {
                return { allowed: false, reason: 'PREMIUM_ONLY' };
            }
        }

        const adminCommands = [
            'protection', 'greet', 'warnings', 'mute', 'unmute', 'promote', 'demote',
            'antidemote', 'antipromote'
        ];
        if (isGroup && adminCommands.includes(commandName)) {
            const userIsAdmin = await isAdmin(sock, jid, sender);
            if (!userIsAdmin) {
                return { allowed: false, reason: 'ADMIN_ONLY' };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('❌ Permission check error:', error.message);
        return { allowed: true };
    }
}

export {
    isAdmin,
    isOwner,
    isPremium,
    isSudoUser,
    canUseInPrivateMode,
    checkPermissions,
    getGroupMetadataWithCache,
    getParticipantInfo
};