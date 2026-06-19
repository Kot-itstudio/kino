//Powered By DarkMods ══════════════════════════════════════════════
//   CONSTANTES ET VARIABLES GLOBALES
// ══════════════════════════════════════════════
const MIN_DELAY = 1500; // 1.5 secondes minimum entre chaque message
const messageTimestamps = new Map(); // Stocke le dernier envoi par chat

// ══════════════════════════════════════════════
//   Envoyer un message avec protection anti rate-limit
// ══════════════════════════════════════════════
async function safeSend(sock, jid, message, options = {}) {
    // Vérification que sock est valide
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
    
    // Attendre si nécessaire
    if (timeSinceLastMessage < MIN_DELAY) {
        const waitTime = MIN_DELAY - timeSinceLastMessage;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
        const result = await sock.sendMessage(jid, message, options);
        messageTimestamps.set(key, Date.now());
        return result;
    } catch (error) {
        // Gestion des erreurs de rate-limit
        if (error.message?.includes('rate-overlimit') || 
            error.message?.includes('too many requests') ||
            error.output?.statusCode === 429 ||
            error.status === 429) {
            console.log(`⚠️ WhatsApp rate limit hit for ${jid}, waiting 10s...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Réessayer une fois
            try {
                const result = await sock.sendMessage(jid, message, options);
                messageTimestamps.set(key, Date.now());
                return result;
            } catch (retryError) {
                console.error('❌ Rate limit persists, message not sent');
                return null;
            }
        }
        
        // Gestion des erreurs de connexion
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            console.error('❌ Socket not connected, message not sent');
            return null;
        }
        
        // Gestion des autres erreurs
        console.error('❌ Send message error:', error.message);
        return null;
    }
}

// ══════════════════════════════════════════════
//   Envoyer une réaction avec protection anti rate-limit
// ══════════════════════════════════════════════
async function safeReact(sock, jid, msg, emoji) {
    // Vérifications
    if (!sock || !jid || !msg || !msg.key) {
        console.error('❌ safeReact: invalid parameters');
        return false;
    }
    
    try {
        await safeSend(sock, jid, {
            react: {
                text: emoji,
                key: msg.key
            }
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
//   Envoyer une présence (typing, recording, etc.)
// ══════════════════════════════════════════════
async function safePresence(sock, jid, type) {
    // Vérifications
    if (!sock || typeof sock.sendPresenceUpdate !== 'function') {
        console.error('❌ safePresence: invalid socket object');
        return false;
    }
    
    if (!jid) {
        console.error('❌ safePresence: jid is required');
        return false;
    }
    
    // Types valides pour WhatsApp
    const validTypes = ['available', 'unavailable', 'composing', 'recording', 'paused'];
    if (!validTypes.includes(type)) {
        console.warn(`⚠️ safePresence: unknown presence type "${type}"`);
        return false;
    }
    
    try {
        await sock.sendPresenceUpdate(type, jid);
        return true;
    } catch (error) {
        // Gestion des erreurs de connexion (silencieuse)
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed') ||
            error.message?.includes('connection') ||
            error.code === 'ECONNRESET') {
            return false;
        }
        
        // Gestion des erreurs rate-limit (silencieuse)
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
//   Nettoyer les anciens timestamps
// ══════════════════════════════════════════════
function cleanupTimestamps() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
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
        console.log(`🧹 Cleaned up ${keysToDelete.length} old message timestamps`);
    }
}

// ══════════════════════════════════════════════
//   Gestion du nettoyage automatique
// ══════════════════════════════════════════════
let cleanupInterval = null;

function startCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    cleanupInterval = setInterval(cleanupTimestamps, 60000);
}

function stopCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

// Démarrer automatiquement
startCleanup();

// ══════════════════════════════════════════════
//   Stats du rate-limiter
// ══════════════════════════════════════════════
function getRateLimitStats() {
    return {
        activeChats: messageTimestamps.size,
        minDelay: MIN_DELAY,
        lastCleanup: Date.now()
    };
}

// ══════════════════════════════════════════════
//   Réinitialiser les timestamps
// ══════════════════════════════════════════════
function resetChatTimestamps(jid) {
    if (jid) {
        const key = `${jid}`;
        messageTimestamps.delete(key);
        console.log(`🔄 Rate limit timestamps reset for ${jid}`);
    } else {
        const count = messageTimestamps.size;
        messageTimestamps.clear();
        console.log(`🔄 Rate limit timestamps reset for all ${count} chats`);
    }
}

// ══════════════════════════════════════════════
//   EXPORTS
// ══════════════════════════════════════════════
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