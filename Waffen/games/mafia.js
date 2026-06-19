import { updateStats, addBalance } from '../db.js'

// NOTE: This module must be valid ESM. Keep all async/await inside async functions.
const mafiaGames = {} // { gameId: { state, players, roles, ... } }

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

const ROLES = {
    MAFIA: 'mafia',
    DOCTOR: 'doctor',
    DETECTIVE: 'detective',
    CIVILIAN: 'civilian'
}

const roleEmojis = {
    [ROLES.MAFIA]: '🔪',
    [ROLES.DOCTOR]: '🏥',
    [ROLES.DETECTIVE]: '🔍',
    [ROLES.CIVILIAN]: '👤'
}

export async function handleMafia(sender, cmd, args, reply, client, jid) {
    const cmdLower = cmd.toLowerCase()
    
    if (cmdLower !== 'mafia') return false
    
    const subCmd = args[0]?.toLowerCase()
    
    if (subCmd === 'create') {
        return handleMafiaCreate(sender, args[1], reply, jid)
    }
    if (subCmd === 'join') {
        return handleMafiaJoin(sender, reply, jid)
    }
    if (subCmd === 'start') {
        return handleMafiaStart(sender, reply, jid, client)
    }
    if (subCmd === 'vote') {
        return handleMafiaVote(sender, args[1], reply, jid, client)
    }
    if (subCmd === 'kill') {
        return handleMafiaKill(sender, args[1], reply, jid, client)
    }
    if (subCmd === 'protect') {
        return handleMafiaProtect(sender, args[1], reply, jid, client)
    }
    if (subCmd === 'check') {
        return handleMafiaCheck(sender, args[1], reply, jid, client)
    }
    if (subCmd === 'status') {
        return handleMafiaStatus(sender, reply, jid)
    }
    
    reply(`Команды мафии:
.mafia create <кол-во> — создать игру (3-10 игроков)
.mafia join — присоединиться
.mafia start — начать игру
.mafia status — статус игры
.mafia vote @юзер — голосовать (день)
.mafia kill @юзер — убить (ночь, мафия)
.mafia protect @юзер — защитить (ночь, доктор)
.mafia check @юзер — проверить (ночь, комиссар)`)
    
    return true
}

function handleMafiaCreate(sender, maxPlayersStr, reply, jid) {
    const maxPlayers = parseInt(maxPlayersStr)
    
    if (isNaN(maxPlayers) || maxPlayers < 3 || maxPlayers > 10) {
        reply('❌ Количество игроков: 3-10')
        return true
    }
    
    if (mafiaGames[jid]) {
        reply('❌ В этом чате уже идет игра мафии')
        return true
    }
    
    mafiaGames[jid] = {
        state: 'waiting', // waiting | night | day | finished
        phase: 'day',
        players: [sender],
        roles: {},
        maxPlayers,
        votes: {},
        protected: null,
        kills: [],
        checked: null,
        day: 0,
        dead: [],
        winner: null
    }
    
    reply(`🔪 *МАФИЯ СОЗДАНА*\n\nМакс игроков: ${maxPlayers}\nТекущих: 1\n\n${sender} создал игру.\n\n.mafia join — присоединиться`)
    return true
}

function handleMafiaJoin(sender, reply, jid) {
    const game = mafiaGames[jid]
    
    if (!game) {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.state !== 'waiting') {
        reply('❌ Игра уже началась')
        return true
    }
    
    if (game.players.includes(sender)) {
        reply('❌ Вы уже в игре')
        return true
    }
    
    if (game.players.length >= game.maxPlayers) {
        reply('❌ Игра полна')
        return true
    }
    
    game.players.push(sender)
    reply(`✅ ${sender} присоединился!\n\nИгроков: ${game.players.length}/${game.maxPlayers}\n\n.mafia start — начать`)
    return true
}

async function handleMafiaStart(sender, reply, jid, client) {
    const game = mafiaGames[jid]
    
    if (!game) {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.players.length < 3) {
        reply('❌ Минимум 3 игрока')
        return true
    }
    
    // Распределяем роли
    const shuffled = game.players.sort(() => Math.random() - 0.5)
    const mafiaCount = Math.ceil(game.players.length / 3)
    const doctorIdx = rand(mafiaCount, game.players.length - 1)
    const detectiveIdx = rand(mafiaCount, game.players.length - 1)
    
    for (let i = 0; i < shuffled.length; i++) {
        let role = ROLES.CIVILIAN
        if (i < mafiaCount) role = ROLES.MAFIA
        if (i === doctorIdx) role = ROLES.DOCTOR
        if (i === detectiveIdx) role = ROLES.DETECTIVE
        game.roles[shuffled[i]] = role
    }
    
    game.state = 'playing'
    game.phase = 'day'
    game.day = 1
    
    // Отправляем роли в DM
    for (const player of game.players) {
        const role = game.roles[player]
        const playerJid = player.includes('@') ? player : `${player}@s.whatsapp.net`
        if (client) {
            try {
                await client.sendMessage(playerJid, {
                    text: `🔪 *МАФИЯ*\n\nТвоя роль: ${roleEmojis[role]} ${role.toUpperCase()}\n\nИгроки: ${game.players.join(', ')}`
                })
            } catch (e) {
                console.error('[MAFIA] Error sending role:', e.message)
            }
        }
    }
    
    reply(`🔪 *ИГРА НАЧАЛАСЬ!* 🔪\n\nИгроки распределены.\nРоли отправлены в DM.\n\n✅ *ДЕНЬ 1*\n\n.mafia vote @юзер — голосовать (изгнание)`)
    game.votes = {}
    
    return true
}

function handleMafiaVote(sender, targetStr, reply, jid, client) {
    const game = mafiaGames[jid]
    
    if (!game || game.state !== 'playing') {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.phase !== 'day') {
        reply('❌ Голосование только днем')
        return true
    }
    
    if (!game.players.includes(sender)) {
        reply('❌ Вы не в игре')
        return true
    }
    
    if (game.dead.includes(sender)) {
        reply('❌ Вы мертвы')
        return true
    }
    
    const target = targetStr.replace(/[^0-9]/g, '')
    if (!target || target === sender || !game.players.includes(target)) {
        reply('❌ Неверная цель')
        return true
    }
    
    game.votes[sender] = target
    
    const votedCount = Object.keys(game.votes).length
    const needVotes = Math.ceil(game.players.length / 2)
    
    reply(`✅ Голос учтен.\n\nГолосов: ${votedCount}/${needVotes}\n\nНужно: ${needVotes} для изгнания`)
    
    // Если все проголосовали
    if (votedCount === game.players.length - game.dead.length) {
        const votes = {}
        for (const [voter, target] of Object.entries(game.votes)) {
            votes[target] = (votes[target] || 0) + 1
        }
        
        const exiled = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]
        game.dead.push(exiled)
        game.phase = 'night'
        
        reply(`😵 ${exiled} изгнан!\n\nРоль: ${roleEmojis[game.roles[exiled]]} ${game.roles[exiled].toUpperCase()}\n\n🌙 НОЧЬ...`)
        game.votes = {}
        
        // Проверяем победу
        checkMafiaWin(game, reply)
        
        // Ночные действия
        setTimeout(() => handleMafiaPhaseNight(game, reply, jid, client), 2000)
    }
    
    return true
}

async function handleMafiaPhaseNight(game, reply, jid, client) {
    if (game.phase !== 'night') return

    const mafia = game.players.filter(p => game.roles[p] === ROLES.MAFIA && !game.dead.includes(p))

    const doctor = game.players.find(p => game.roles[p] === ROLES.DOCTOR && !game.dead.includes(p))
    const detective = game.players.find(p => game.roles[p] === ROLES.DETECTIVE && !game.dead.includes(p))
    
    // Мафия убивает
    if (mafia.length > 0) {
        const target = game.players[rand(0, game.players.length - 1)]
        if (!game.dead.includes(target) && game.roles[target] !== ROLES.MAFIA) {
            if (target !== game.protected) {
                game.dead.push(target)
            }
        }
    }
    
    game.protected = null
    game.phase = 'day'
    game.day++
    
    reply(`☀️ *ДЕНЬ ${game.day}*\n\n.mafia vote @юзер — голосовать`)
}

function handleMafiaKill(sender, targetStr, reply, jid, client) {
    const game = mafiaGames[jid]
    
    if (!game || game.state !== 'playing') {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.phase !== 'night') {
        reply('❌ Убийство только ночью')
        return true
    }
    
    if (game.roles[sender] !== ROLES.MAFIA) {
        reply('❌ Это не ваша способность')
        return true
    }
    
    const target = targetStr.replace(/[^0-9]/g, '')
    game.kills.push(target)
    reply('✅ Цель выбрана')
    return true
}

function handleMafiaProtect(sender, targetStr, reply, jid, client) {
    const game = mafiaGames[jid]
    
    if (!game || game.state !== 'playing') {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.phase !== 'night') {
        reply('❌ Защита только ночью')
        return true
    }
    
    if (game.roles[sender] !== ROLES.DOCTOR) {
        reply('❌ Это не ваша способность')
        return true
    }
    
    const target = targetStr.replace(/[^0-9]/g, '')
    game.protected = target
    reply('✅ Защита активирована')
    return true
}

function handleMafiaCheck(sender, targetStr, reply, jid, client) {
    const game = mafiaGames[jid]
    
    if (!game || game.state !== 'playing') {
        reply('❌ Нет активной игры')
        return true
    }
    
    if (game.phase !== 'night') {
        reply('❌ Проверка только ночью')
        return true
    }
    
    if (game.roles[sender] !== ROLES.DETECTIVE) {
        reply('❌ Это не ваша способность')
        return true
    }
    
    const target = targetStr.replace(/[^0-9]/g, '')
    const isMafia = game.roles[target] === ROLES.MAFIA
    reply(`🔍 ${target}: ${isMafia ? '🔪 МАФИЯ' : '✅ Чистый'}`)
    return true
}

function handleMafiaStatus(sender, reply, jid) {
    const game = mafiaGames[jid]
    
    if (!game) {
        reply('❌ Нет активной игры')
        return true
    }
    
    const alive = game.players.filter(p => !game.dead.includes(p))
    const status = `
🔪 *СТАТУС ИГРЫ*

🌍 Фаза: ${game.phase === 'day' ? '☀️ ДЕНЬ' : '🌙 НОЧЬ'}
📊 День: ${game.day}

👥 Живых: ${alive.length}
💀 Мертвых: ${game.dead.length}

Живые: ${alive.join(', ')}
`
    reply(status)
    return true
}

function checkMafiaWin(game, reply) {
    const alive = game.players.filter(p => !game.dead.includes(p))
    const mafia = alive.filter(p => game.roles[p] === ROLES.MAFIA)
    const civilians = alive.filter(p => game.roles[p] !== ROLES.MAFIA)
    
    if (mafia.length === 0) {
        reply(`🎉 *ПОБЕДА ГОРОДА!* 🎉\n\nВся мафия устранена!`)
        game.state = 'finished'
        return true
    }
    
    if (mafia.length >= civilians.length) {
        reply(`💀 *ПОБЕДА МАФИИ!* 💀\n\nМафия захватила город!`)
        game.state = 'finished'
        return true
    }
    
    return false
}

export default handleMafia
