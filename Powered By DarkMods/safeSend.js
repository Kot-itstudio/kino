// Powered By DarkMods

// ══════════════════════════════════════════════
//   CONSTANTES ET VARIABLES GLOBALES
// ══════════════════════════════════════════════
const MIN_DELAY = 1500;
const messageTimestamps = new Map();

// ══════════════════════════════════════════════
//   Envoyer un message avec protection anti rate-limit
// ══════════════════════════════════════════════
async function safeSend(sock, jid, message, options = {}) {
    if (!sock || typeof sock.sendMessage !== 'function') {
        console.error('❌ safeSend: invalid socket object');
        return null;
    }
    
    if (!jid) {
        console.error('❌ safeSend: jid is required');
        return null;
    }
    
    const key = `${jid}`;
    const now = Date.now();
    const lastTime = messageTimestamps.get(key) || 0;
    const timeSinceLastMessage = now - lastTime;
    
    if (timeSinceLastMessage < MIN_DELAY) {
        const waitTime = MIN_DELAY - timeSinceLastMessage;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
        const result = await sock.sendMessage(jid, message, options);
        messageTimestamps.set(key, Date.now());
        return result;
    } catch (error) {
        if (error.message?.includes('rate-overlimit') || 
            error.message?.includes('too many requests') ||
            error.output?.statusCode === 429 ||
            error.status === 429) {
            console.log(`⚠️ Rate limit for ${jid}, waiting 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            try {
                const result = await sock.sendMessage(jid, message, options);
                messageTimestamps.set(key, Date.now());
                return result;
            } catch (retryError) {
                console.error('❌ Rate limit persists');
                return null;
            }
        }
        
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            console.error('❌ Socket not connected');
            return null;
        }
        
        console.error('❌ Send message error:', error.message);
        return null;
    }
}

// ══════════════════════════════════════════════
//   Envoyer une réaction
// ══════════════════════════════════════════════
async function safeReact(sock, jid, msg, emoji) {
    if (!sock || !jid || !msg || !msg.key) {
        console.error('❌ safeReact: invalid parameters');
        return false;
    }
    
    try {
        await safeSend(sock, jid, {
            react: { text: emoji, key: msg.key }
        });
        return true;
    } catch (error) {
        if (!error.message?.includes('rate-overlimit') && 
            !error.message?.includes('too many requests') &&
            error.output?.statusCode !== 429 &&
            error.status !== 429) {
            console.error('❌ Reaction error:', error.message);
        }
        return false;
    }
}

// ══════════════════════════════════════════════
//   Envoyer une présence
// ══════════════════════════════════════════════
async function safePresence(sock, jid, type) {
    if (!sock || typeof sock.sendPresenceUpdate !== 'function') {
        console.error('❌ safePresence: invalid socket object');
        return false;
    }
    
    if (!jid) {
        console.error('❌ safePresence: jid is required');
        return false;
    }
    
    const validTypes = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    if (!validTypes.includes(type)) {
        console.warn(`⚠️ Unknown presence type: ${type}`);
        return false;
    }
    
    try {
        await sock.sendPresenceUpdate(type, jid);
        return true;
    } catch (error) {
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            return false;
        }
        
        if (!error.message?.includes('rate-overlimit') && 
            !error.message?.includes('too many requests') &&
            error.output?.statusCode !== 429 &&
            error.status !== 429) {
            console.error('❌ Presence error:', error.message);
        }
        return false;
    }
}

// ══════════════════════════════════════════════
//   Nettoyage
// ══════════════════════════════════════════════
function cleanupTimestamps() {
    const now = Date.now();
    const maxAge = 60000;
    
    const keysToDelete = [];
    for (const [key, timestamp] of messageTimestamps.entries()) {
        if (now - timestamp > maxAge) {
            keysToDelete.push(key);
        }
    }
    
    for (const key of keysToDelete) {
        messageTimestamps.delete(key);
    }
    
    if (keysToDelete.length > 0) {
        console.log(`🧹 Cleaned ${keysToDelete.length} timestamps`);
    }
}

let cleanupInterval = null;

function startCleanup() {
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = setInterval(cleanupTimestamps, 60000);
}

function stopCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

startCleanup();

function getRateLimitStats() {
    return {
        activeChats: messageTimestamps.size,
        minDelay: MIN_DELAY,
        lastCleanup: Date.now()
    };
}

function resetChatTimestamps(jid) {
    if (jid) {
        messageTimestamps.delete(`${jid}`);
        console.log(`🔄 Reset timestamps for ${jid}`);
    } else {
        const count = messageTimestamps.size;
        messageTimestamps.clear();
        console.log(`🔄 Reset all ${count} timestamps`);
    }
}

export {
    safeSend,
    safeReact,
    safePresence,
    cleanupTimestamps,
    startCleanup,
    stopCleanup,
    getRateLimitStats,
    resetChatTimestamps
};