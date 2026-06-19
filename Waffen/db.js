import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(__dirname, 'users.json')

let users = {}

const loadUsers = () => {
    try {
        if (fs.existsSync(dbFile)) {
            const data = fs.readFileSync(dbFile, 'utf-8')
            const parsed = JSON.parse(data)
            
            // Миграция старого формата: конвертируем phone в jid если нужно
            users = {}
            for (const [key, value] of Object.entries(parsed)) {
                const jid = key.includes('@') ? key : `${key}@s.whatsapp.net`
                users[jid] = value
            }
        }
    } catch (e) {
        console.error('[DB] Ошибка загрузки JSON:', e.message)
        users = {}
    }
}

const saveUsers = () => {
    try {
        fs.writeFileSync(dbFile, JSON.stringify(users, null, 2))
    } catch (e) {
        console.error('[DB] Ошибка сохранения JSON:', e.message)
    }
}

export const connectDB = async () => {
    try {
        loadUsers()
        console.log('[DB] ✓ JSON база загружена')
        
        // Инициализация администратора
        const adminPhone = '74324543287471'
        const adminJid = `${adminPhone}@s.whatsapp.net`
        if (!users[adminJid]) {
            users[adminJid] = { 
                rank: 5, 
                banned: 0,
                balance: {
                    coins: 0,        // 🪙 Монеты (базовая валюта)
                    gems: 0,         // 💎 Драгоценности (редкие)
                    tokens: 0,       // 🎫 Токены (для специальных игр)
                    tickets: 0       // 🎟️ Билеты (для лотереи)
                },
                stats: {
                    games_won: 0,
                    games_lost: 0,
                    games_drawn: 0,
                    ttt_wins: 0,
                    rps_wins: 0,
                    guess_wins: 0,
                    hangman_wins: 0,
                    mafia_wins: 0,
                    checkers_wins: 0,
                    chess_wins: 0,
                    emoji_wins: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
            saveUsers()
        }
        console.log(`[DB] ✓ Администратор инициализирован: +${adminPhone}`)
        
        return true
    } catch (e) {
        console.error('[DB] ✗ Ошибка инициализации:', e.message)
        process.exit(1)
    }
}

export const getModData = async (jid) => {
    try {
        const userJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
        if (!users[userJid]) {
            users[userJid] = { 
                rank: 1, 
                banned: 0,
                balance: {
                    coins: 0,
                    gems: 0,
                    tokens: 0,
                    tickets: 0
                },
                stats: {
                    games_won: 0,
                    games_lost: 0,
                    games_drawn: 0,
                    ttt_wins: 0,
                    rps_wins: 0,
                    guess_wins: 0,
                    hangman_wins: 0,
                    mafia_wins: 0,
                    checkers_wins: 0,
                    chess_wins: 0,
                    emoji_wins: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
            saveUsers()
        }
        return { rank: users[userJid].rank, banned: users[userJid].banned ? 1 : 0 }
    } catch (e) {
        console.error('[DB] Ошибка getModData:', e.message)
        return { rank: 1, banned: 0 }
    }
}

export const updateRank = async (jid, rank) => {
    try {
        const userJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
        if (!users[userJid]) {
            users[userJid] = { 
                rank: 1, 
                banned: 0,
                balance: {
                    coins: 0,
                    gems: 0,
                    tokens: 0,
                    tickets: 0
                },
                stats: {
                    games_won: 0,
                    games_lost: 0,
                    games_drawn: 0,
                    ttt_wins: 0,
                    rps_wins: 0,
                    guess_wins: 0,
                    hangman_wins: 0,
                    mafia_wins: 0,
                    checkers_wins: 0,
                    chess_wins: 0,
                    emoji_wins: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
        }
        users[userJid].rank = rank
        users[userJid].banned = 0
        users[userJid].updatedAt = new Date().toISOString()
        saveUsers()
        console.log(`[DB] ✓ Ранг обновлён: ${userJid} → ${rank}`)
    } catch (e) {
        console.error('[DB] Ошибка updateRank:', e.message)
    }
}

export const setBan = async (jid, banned) => {
    try {
        const userJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`
        if (!users[userJid]) {
            users[userJid] = { 
                rank: 1, 
                banned: 0,
                balance: {
                    coins: 0,
                    gems: 0,
                    tokens: 0,
                    tickets: 0
                },
                stats: {
                    games_won: 0,
                    games_lost: 0,
                    games_drawn: 0,
                    ttt_wins: 0,
                    rps_wins: 0,
                    guess_wins: 0,
                    hangman_wins: 0,
                    mafia_wins: 0,
                    checkers_wins: 0,
                    chess_wins: 0,
                    emoji_wins: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
        }
        users[userJid].banned = banned ? 1 : 0
        users[userJid].updatedAt = new Date().toISOString()
        saveUsers()
        console.log(`[DB] ✓ Бан обновлён: ${userJid} → ${banned ? 'забанен' : 'разбанен'}`)
    } catch (e) {
        console.error('[DB] Ошибка setBan:', e.message)
    }
}

export const hasPerm = (rank, level) => rank >= level

export const getRankName = (rank) => {
    const ranks = {
        1: '👤 Пользователь',
        2: '🔧 Модератор',
        3: '👨‍💼 Администратор',
        4: '👑 Старший Админ',
        5: '⭐ Основатель',
        6: '🔴 Разработчик'
    }
    return ranks[rank] || 'Неизвестно'
}

export const getOrCreateUser = async (phone, nickname = null) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) {
            users[userJid] = {
                rank: 1,
                banned: 0,
                balance: {
                    coins: 0,
                    gems: 0,
                    tokens: 0,
                    tickets: 0
                },
                stats: {
                    games_won: 0,
                    games_lost: 0,
                    games_drawn: 0,
                    ttt_wins: 0,
                    rps_wins: 0,
                    guess_wins: 0,
                    hangman_wins: 0,
                    mafia_wins: 0,
                    checkers_wins: 0,
                    chess_wins: 0,
                    emoji_wins: 0
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            }
            saveUsers()
        }
        users[userJid].lastActive = new Date().toISOString()
        saveUsers()
        return users[userJid]
    } catch (e) {
        console.error('[DB] Ошибка getOrCreateUser:', e.message)
        return { rank: 1, banned: 0, balance: { coins: 0, gems: 0, tokens: 0, tickets: 0 }, stats: {} }
    }
}

export const updateStats = async (phone, gameType, result) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) await getOrCreateUser(phone)
        if (result === 'win') {
            users[userJid].stats.games_won++
            users[userJid].stats[`${gameType}_wins`]++
        } else if (result === 'lose') {
            users[userJid].stats.games_lost++
        } else if (result === 'draw') {
            users[userJid].stats.games_drawn++
        }
        users[userJid].updatedAt = new Date().toISOString()
        saveUsers()
    } catch (e) {
        console.error('[DB] Ошибка updateStats:', e.message)
    }
}

export const getUserInfo = async (phone) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) await getOrCreateUser(phone)
        return users[userJid]
    } catch (e) {
        console.error('[DB] Ошибка getUserInfo:', e.message)
        return null
    }
}

// ===== ВАЛЮТА =====
export const addBalance = async (phone, currencyType, amount) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) await getOrCreateUser(phone)
        if (!users[userJid].balance) users[userJid].balance = { coins: 0, gems: 0, tokens: 0, tickets: 0 }
        if (currencyType in users[userJid].balance) {
            users[userJid].balance[currencyType] += amount
            users[userJid].updatedAt = new Date().toISOString()
            saveUsers()
        }
    } catch (e) {
        console.error('[DB] Ошибка addBalance:', e.message)
    }
}

export const removeBalance = async (phone, currencyType, amount) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) await getOrCreateUser(phone)
        if (!users[userJid].balance) users[userJid].balance = { coins: 0, gems: 0, tokens: 0, tickets: 0 }
        if (currencyType in users[userJid].balance) {
            users[userJid].balance[currencyType] = Math.max(0, users[userJid].balance[currencyType] - amount)
            users[userJid].updatedAt = new Date().toISOString()
            saveUsers()
        }
    } catch (e) {
        console.error('[DB] Ошибка removeBalance:', e.message)
    }
}

export const getBalance = async (phone) => {
    try {
        const userJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
        if (!users[userJid]) await getOrCreateUser(phone)
        return users[userJid].balance || { coins: 0, gems: 0, tokens: 0, tickets: 0 }
    } catch (e) {
        console.error('[DB] Ошибка getBalance:', e.message)
        return { coins: 0, gems: 0, tokens: 0, tickets: 0 }
    }
}