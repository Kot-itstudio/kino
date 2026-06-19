import { updateStats, addBalance } from '../db.js'

const emojiGames = {}
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

const emojiList = [
    { emoji: '😀', name: 'happy' },
    { emoji: '😂', name: 'laughing' },
    { emoji: '😍', name: 'love' },
    { emoji: '😱', name: 'shocked' },
    { emoji: '😡', name: 'angry' },
    { emoji: '😴', name: 'sleepy' },
    { emoji: '🤔', name: 'thinking' },
    { emoji: '😎', name: 'cool' },
    { emoji: '🤗', name: 'hug' },
    { emoji: '😢', name: 'sad' },
    { emoji: '🤢', name: 'sick' },
    { emoji: '😈', name: 'devil' },
    { emoji: '💀', name: 'skull' },
    { emoji: '👻', name: 'ghost' },
    { emoji: '🐶', name: 'dog' },
    { emoji: '🐱', name: 'cat' },
    { emoji: '🐭', name: 'mouse' },
    { emoji: '🐹', name: 'hamster' },
    { emoji: '🐰', name: 'rabbit' },
    { emoji: '🦊', name: 'fox' },
    { emoji: '🐻', name: 'bear' },
    { emoji: '🐼', name: 'panda' },
    { emoji: '🐨', name: 'koala' },
    { emoji: '🐯', name: 'tiger' },
    { emoji: '🦁', name: 'lion' },
    { emoji: '🐮', name: 'cow' },
    { emoji: '🐷', name: 'pig' },
    { emoji: '🐸', name: 'frog' },
    { emoji: '🐵', name: 'monkey' },
    { emoji: '🐔', name: 'chicken' },
    { emoji: '❤️', name: 'heart' },
    { emoji: '💔', name: 'broken_heart' },
    { emoji: '💪', name: 'muscle' },
    { emoji: '👍', name: 'thumbs_up' },
    { emoji: '👎', name: 'thumbs_down' },
    { emoji: '🎮', name: 'game' },
    { emoji: '🎯', name: 'target' },
    { emoji: '🏆', name: 'trophy' },
    { emoji: '⚡', name: 'lightning' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '❄️', name: 'ice' },
    { emoji: '💧', name: 'water' },
    { emoji: '🌊', name: 'wave' },
    { emoji: '🌈', name: 'rainbow' },
    { emoji: '⭐', name: 'star' },
    { emoji: '✨', name: 'sparkles' },
    { emoji: '🌙', name: 'moon' },
    { emoji: '☀️', name: 'sun' },
]

export async function handleEmojiGame(sender, args, reply, client, jid) {
    if (args[0] === 'invite' && args[1]) {
        return handleEmojiInvite(sender, args[1], reply, client, jid)
    }
    
    if (args[0] === 'accept' && args[1]) {
        return handleEmojiAccept(sender, args[1], reply, client, jid)
    }
    
    if (args[0] === 'guess' && args[1]) {
        return handleEmojiGuess(sender, args[1], reply, client, jid)
    }
    
    if (args[0] === 'decline') {
        return handleEmojiDecline(sender, reply, client, jid)
    }
    
    // Single player mode
    if (!args[0] || args[0] === 'start') {
        const item = emojiList[rand(0, emojiList.length - 1)]
        emojiGames[sender] = { ...item }
        
        const hints = [
            `🔤 Угадай смайлик! (Начинается на ${item.name[0].toUpperCase()})`,
            `🔤 Угадай смайлик! (${item.emoji})`,
            `🔤 Угадай смайлик! (Слово из ${item.name.length} букв)`
        ]
        
        reply(hints[rand(0, hints.length - 1)] + '\n\n.emoji guess <название>')
        return true
    }
    
    return false
}

function handleEmojiInvite(sender, target, reply, client, jid) {
    // TODO: Multiplayer invite logic
    reply('🎯 Приглашение отправлено')
    return true
}

function handleEmojiAccept(sender, target, reply, client, jid) {
    // TODO: Multiplayer accept logic
    return true
}

async function handleEmojiGuess(sender, guess, reply, client, jid) {
    const game = emojiGames[sender]
    
    if (!game) {
        reply('❌ Сначала начните игру: .emoji')
        return true
    }
    
    const guessLower = guess.toLowerCase()
    const correct = guessLower === game.name
    
    delete emojiGames[sender]
    
    if (correct) {
        await updateStats(sender, 'emoji', 'win')
        await addBalance(sender, 'coins', 50)
        reply(`🎉 *ВЕРНО!* 🎉\n\nСмайлик: ${game.emoji} (${game.name})\n\n✅ +50 🪙 монет!`)
    } else {
        await updateStats(sender, 'emoji', 'lose')
        reply(`❌ Неверно!\n\nПравильный ответ: ${game.emoji} (${game.name})\n\nПопробуйте еще: .emoji`)
    }
    
    return true
}

function handleEmojiDecline(sender, reply, client, jid) {
    if (emojiGames[sender]) {
        delete emojiGames[sender]
        reply('Игра отменена')
        return true
    }
    reply('❌ Нет активной игры')
    return true
}

export default handleEmojiGame
