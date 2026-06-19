// messageStore.js - AntiDelete Storage
import fs from 'fs';
import path from 'path';

class MessageStore {
    constructor() {
        this.messageCache = new Map();
        this.setupCleanupInterval();
        this.ensureTempDir();
    }

    ensureTempDir() {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
    }

    async storeMessage(msg, content = '', mediaInfo = null) {
        try {
            const messageId = msg.key.id;
            if (!messageId) return null;

            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = msg.key.remoteJid?.endsWith('@g.us') || false;

            const messageData = {
                messageId,
                sender,
                jid: msg.key.remoteJid,
                content: content || '',
                mediaType: mediaInfo?.type || null,
                mediaPath: mediaInfo?.path || null,
                isGroup,
                timestamp: Date.now()
            };

            this.messageCache.set(messageId, messageData);

            // Limite du cache
            if (this.messageCache.size > 500) {
                const firstKey = this.messageCache.keys().next().value;
                this.deleteMessage(firstKey);
            }

            return messageData;
        } catch (error) {
            console.error('storeMessage error:', error.message);
            return null;
        }
    }

    getMessage(messageId) {
        if (!messageId) return null;
        return this.messageCache.get(messageId) || null;
    }

    deleteMessage(messageId) {
        const message = this.messageCache.get(messageId);
        
        if (message?.mediaPath) {
            try {
                if (fs.existsSync(message.mediaPath)) {
                    fs.unlinkSync(message.mediaPath);
                }
            } catch (e) {
                // Silence
            }
        }
        
        this.messageCache.delete(messageId);
    }

    setupCleanupInterval() {
        setInterval(() => {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            
            for (const [messageId, message] of this.messageCache.entries()) {
                if (message.timestamp < oneHourAgo) {
                    this.deleteMessage(messageId);
                }
            }
        }, 30 * 60 * 1000);
    }

    getStats() {
        return {
            size: this.messageCache.size,
            keys: Array.from(this.messageCache.keys())
        };
    }

    clearAll() {
        for (const [messageId] of this.messageCache.entries()) {
            this.deleteMessage(messageId);
        }
    }
}

const messageStore = new MessageStore();
export default messageStore;