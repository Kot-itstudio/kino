import { updateStats } from '../db.js'
import handleMafia from './mafia.js'
import handleEmojiGame from './emoji.js'
import handleCheckers from './checkers.js'
import handleChess from './chess.js'
import handleWordQuestion from './word_question.js'

const sessions = {}


const pendingInvites = {} // { "player1": { invited_by, game, expires_at }, ... }

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const getGameId = (p1, p2) => [p1, p2].sort().join('+')
const now = () => Date.now()
const INVITE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

/* --- TicTacToe --- */
const newTic = () => ({ board: Array(9).fill(' '), turn: null })

const checkWin = (b, p) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    return lines.some(l => l.every(i => b[i] === p))
}
const renderBoard = (b) => {
    const cell = (i) => {
        if (b[i] === 'X') return '❌'
        if (b[i] === 'O') return '⭕'
        return i + 1
    }
    return `
┌─┬─┬─┐
│${cell(0)}│${cell(1)}│${cell(2)}│
├─┼─┼─┤
│${cell(3)}│${cell(4)}│${cell(5)}│
├─┼─┼─┤
│${cell(6)}│${cell(7)}│${cell(8)}│
└─┴─┴─┘`.trim()
}


/* --- RPS --- */
const rpsWinner = (you, bot) => {
    if (you === bot) return 'draw'
    if ((you === 'rock' && bot === 'scissors') || (you === 'scissors' && bot === 'paper') || (you === 'paper' && bot === 'rock')) return 'win'
    return 'lose'
}

const getPhoneFromJID = (jid) => jid?.match(/^(\d+)@/)?.[1] || jid
const toUserJid = (phone) => {
    if (!phone) return phone
    if (phone.includes('@')) return phone
    const digits = phone.replace(/\D/g, '')
    return `${digits}@s.whatsapp.net`
}

export default async function handleGames(sender, cmd, args, reply, client = null, jid = null) {
    const cmdLower = cmd.toLowerCase()

    // ===== SINGLE PLAYER GAMES =====
    if (cmdLower === 'rps' && args[0] !== 'i') {
        return handleRPSSingle(sender, args, reply)
    }
    if (cmdLower === 'quiz' || (cmdLower === 'scramble')) {
        return handleSingleGame(sender, cmdLower, args, reply)
    }

    // ===== MULTIPLAYER GAMES =====
    
    // Mafia
    if (cmdLower === 'mafia') {
        return handleMafia(sender, cmd, args, reply, client, jid)
    }

    // Checkers
    if (cmdLower === 'checkers') {
        return handleCheckers(sender, cmd, args, reply, client, jid)
    }

    // Chess
    if (cmdLower === 'chess') {
        return handleChess(sender, cmd, args, reply, client, jid)
    }

    // Emoji multiplayer not implemented (single-player only)
    if (cmdLower === 'emoji' && args[0] === 'invite') {
        return handleEmojiGame(sender, args, reply, client, jid)
    }

    // TTT
    if (cmdLower === 'ttt') {

        if (args[0] === 'i' && args[1]) {
            return handleTTTInvite(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'a' && args[1]) {
            return handleTTTAccept(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'd') {
            return handleTTTDecline(sender, reply, client, jid)
        }
        if (args[0] === 'm' && args[1]) {
            return handleTTTMove(sender, args[1], reply, client, jid)
        }
        return reply('Использование: .ttt invite @юзер | .ttt move <1-9> | .ttt accept @юзер | .ttt decline')
    }

    // RPS Multiplayer
    if (cmdLower === 'rps' && args[0] === 'invite' && args[1]) {
        return handleRPSInvite(sender, args[1], reply, client, jid)
    }
    if (cmdLower === 'rps' && args[0] === 'accept' && args[1]) {
        return handleRPSAccept(sender, args[1], reply, client, jid)
    }
    if (cmdLower === 'rps' && args[0] === 'decline') {
        return handleRPSDecline(sender, reply, client, jid)
    }
    if (cmdLower === 'rps' && args[0] === 'choice' && args[1]) {
        return handleRPSChoice(sender, args[1], reply, client, jid)
    }

    // Guess
    if (cmdLower === 'guess') {
        if (args[0] === 'i' && args[1]) {
            return handleGuessInvite(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'a' && args[1]) {
            return handleGuessAccept(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'num' && args[1]) {
            return handleGuessSetNumber(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'guess' && args[1]) {
            return handleGuessGuess(sender, args[1], reply, client, jid)
        }
        return reply('Использование: .guess invite @юзер | .guess accept @юзер | .guess number <1-30> | .guess guess <число>')
    }

    // Hangman (угадай слово по буквам)
    if (cmdLower === 'hangman') {

        if (args[0] === 'i' && args[1]) {
            return handleHangmanInvite(sender, args[1], reply, client, jid)
        }

        if (args[0] === 'a' && args[1]) {
            return handleHangmanAccept(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'word' && args[1]) {
            return handleHangmanWord(sender, args[1], reply, client, jid)
        }
        if (args[0] === 'guess' && args[1]) {
            return handleHangmanGuess(sender, args[1], reply, client, jid)
        }
        return reply('Использование: .hangman invite @юзер | .hangman accept @юзер | .hangman word <слово> | .hangman guess <буква>')
    }

    return false
}

// ===== TTT MULTIPLAYER =====
async function handleTTTInvite(sender, target, reply, client, jid) {
    if (!target) return reply('Укажите @участника')
    
    // Extract phone from @mention or direct number
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'ttt', invited_by: sender, expires_at: now() + INVITE_TIMEOUT }
    
    // Send invite to target's DM if client is available
    if (client) {
        try {
            const inviteMsg = `🎮 ${sender} приглашает тебя в Крестики-Нолики!\n\nПримери: .ttt accept ${sender} | .ttt decline`
            await client.sendMessage(toUserJid(targetPhone), { text: inviteMsg })
        } catch (e) {
            console.error('[GAME] Error sending invite:', e.message)
        }
    }
    
    reply(`📬 Приглашение отправлено @${targetPhone}`)
    return true
}

async function handleTTTAccept(sender, inviter, reply, client, jid) {
    // Extract phone from @mention or direct number
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    const gid = getGameId(sender, inviterPhone)
    sessions[gid] = { game: 'ttt', p1: inviterPhone, p2: sender, state: newTic(), turn: inviterPhone }

    delete pendingInvites[sender]
    
    const boardMsg = `✅ Игра началась! ${inviterPhone} vs ${sender}\n\n${renderBoard(sessions[gid].state.board)}\n\nХод ${inviterPhone}. Команда: .ttt move <1-9>`
    reply(boardMsg)
    
    // Send board to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: boardMsg })
        } catch (e) {
            console.error('[GAME] Error sending board:', e.message)
        }
    }
    
    return true
}

async function handleTTTDecline(sender, reply, client, jid) {
    if (pendingInvites[sender]) {
        const inviter = pendingInvites[sender].invited_by
        delete pendingInvites[sender]
        const declineMsg = `❌ ${sender} отклонил приглашение`
        reply(declineMsg)
        
        // Notify inviter if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(inviter), { text: declineMsg })
            } catch (e) {
                console.error('[GAME] Error sending decline:', e.message)
            }
        }
        return true
    }
    return reply('Нет активного приглашения')
}

async function handleTTTMove(sender, moveStr, reply, client, jid) {
    const pos = parseInt(moveStr) - 1
    if (isNaN(pos) || pos < 0 || pos > 8) return reply('Укажите позицию 1-9')
    
    // Find game where sender is a player
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'ttt' && (g.p1 === sender || g.p2 === sender)) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в TTT игре')
    if (game.turn !== sender) return reply('❌ Сейчас не ваш ход')
    if (game.state.board[pos] !== ' ') return reply('❌ Клетка занята')
    
    const playerSymbol = sender === game.p1 ? 'X' : 'O'
    game.state.board[pos] = playerSymbol
    
    if (checkWin(game.state.board, playerSymbol)) {
        const winner = sender
        const loser = sender === game.p1 ? game.p2 : game.p1
        await updateStats(winner, 'ttt', 'win')
        await updateStats(loser, 'ttt', 'lose')
        delete sessions[gid]
        
        const resultMsg = `${renderBoard(game.state.board)}\n\n🎉 ${winner} ПОБЕДИЛ!`
        reply(resultMsg)
        
        // Send result to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(loser), { text: resultMsg })
            } catch (e) {
                console.error('[GAME] Error sending result:', e.message)
            }
        }
        return true
    }
    
    if (game.state.board.every(c => c !== ' ')) {
        const p1 = game.p1
        const p2 = game.p2
        await updateStats(p1, 'ttt', 'draw')
        await updateStats(p2, 'ttt', 'draw')
        delete sessions[gid]
        
        const drawMsg = `${renderBoard(game.state.board)}\n\n🤝 НИЧЬЯ`
        reply(drawMsg)
        
        // Send draw to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(p1 === sender ? p2 : p1), { text: drawMsg })
            } catch (e) {
                console.error('[GAME] Error sending draw:', e.message)
            }
        }
        return true
    }
    
    game.turn = sender === game.p1 ? game.p2 : game.p1
    const boardMsg = `${renderBoard(game.state.board)}\n\nХод игрока ${game.turn}. Команда: .ttt move <1-9>`
    reply(boardMsg)
    
    // Send board update to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(game.turn), { text: boardMsg })
        } catch (e) {
            console.error('[GAME] Error sending board update:', e.message)
        }
    }
    
    return true
}

// ===== RPS SINGLE PLAYER =====
async function handleRPSSingle(sender, args, reply) {
    if (args.length === 0) return reply('Использование: .rps <камень|ножницы|бумага>')
    const map = {камень:'rock', ножницы:'scissors', бумага:'paper', rock:'rock', paper:'paper', scissors:'scissors'}
    const choice = map[args[0].toLowerCase()]
    if (!choice) return reply('Неверный выбор (камень, ножницы, бумага)')
    
    const choices = ['rock', 'paper', 'scissors']
    const bot = choices[rand(0, 2)]
    const result = rpsWinner(choice, bot)
    
    const iconMap = { rock: '🪨', paper: '📄', scissors: '✂️' }
    let msg = `Вы: ${iconMap[choice]} ${choice}\nБот: ${iconMap[bot]} ${bot}\n`
    
    if (result === 'win') {
        msg += '🎉 Вы выиграли!'
    } else if (result === 'lose') {
        msg += '😔 Бот выиграл'
    } else {
        msg += '🤝 Ничья'
    }
    
    reply(msg)
    return true
}

// ===== RPS MULTIPLAYER =====
async function handleRPSInvite(sender, target, reply, client, jid) {
    if (!target) return reply('Укажите @участника')
    
    // Extract phone from @mention or direct number
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'rps', invited_by: sender, expires_at: now() + INVITE_TIMEOUT }
    
    // Send invite to target's DM if client is available
    if (client) {
        try {
            const inviteMsg = `🎮 ${sender} приглашает тебя в РПС!\n\nПримери: .rps accept ${sender} | .rps decline`
            await client.sendMessage(toUserJid(targetPhone), { text: inviteMsg })
        } catch (e) {
            console.error('[GAME] Error sending RPS invite:', e.message)
        }
    }
    
    reply(`📬 Приглашение в РПС отправлено @${targetPhone}`)
    return true
}

async function handleRPSAccept(sender, inviter, reply, client, jid) {
    // Extract phone from @mention or direct number
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    
    const gid = getGameId(sender, inviterPhone)
    sessions[gid] = {
        game: 'rps',
        p1: inviterPhone,
        p2: sender,
        p1_choice: null,
        p2_choice: null,
        round: 1,
        max_rounds: 3,
        p1_wins: 0,
        p2_wins: 0
    }
    delete pendingInvites[sender]
    
    const choiceMsg = `✅ Игра началась! Раунд 1/3\n\nВыбери: .rps choice <камень|ножницы|бумага>\n\n🪨 камень\n📄 бумага\n✂️ ножницы`
    reply(choiceMsg)
    
    // Send to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: choiceMsg })
        } catch (e) {
            console.error('[GAME] Error sending RPS game start:', e.message)
        }
    }
    
    return true
}

async function handleRPSChoice(sender, choice, reply, client, jid) {
    const choiceMap = { камень: 'rock', ножницы: 'scissors', бумага: 'paper', rock: 'rock', paper: 'paper', scissors: 'scissors' }
    const normalizedChoice = choiceMap[choice.toLowerCase()]
    
    if (!normalizedChoice) return reply('❌ Выбери: камень, ножницы или бумага')
    
    // Find game where sender is a player
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'rps' && (g.p1 === sender || g.p2 === sender)) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в РПС игре')
    
    // Record choice
    if (sender === game.p1) {
        if (game.p1_choice) return reply('❌ Вы уже сделали выбор в этом раунде')
        game.p1_choice = normalizedChoice
    } else {
        if (game.p2_choice) return reply('❌ Вы уже сделали выбор в этом раунде')
        game.p2_choice = normalizedChoice
    }
    
    reply('✅ Выбор записан')
    
    // If both players chose, determine winner
    if (game.p1_choice && game.p2_choice) {
        const result = rpsWinner(game.p1_choice, game.p2_choice)
        const iconMap = { rock: '🪨', paper: '📄', scissors: '✂️' }
        
        let resultMsg = `⚔️ Раунд ${game.round}:\n\n${game.p1}: ${iconMap[game.p1_choice]} ${game.p1_choice}\n${game.p2}: ${iconMap[game.p2_choice]} ${game.p2_choice}\n\n`
        
        if (result === 'draw') {
            resultMsg += '🤝 Ничья!'
        } else if (result === 'win') {
            resultMsg += `🎉 ${game.p1} выиграл!`
            game.p1_wins++
        } else {
            resultMsg += `🎉 ${game.p2} выиграл!`
            game.p2_wins++
        }
        
        // Check if series is over
        if (game.p1_wins > game.max_rounds / 2 || game.p2_wins > game.max_rounds / 2) {
            const winner = game.p1_wins > game.p2_wins ? game.p1 : game.p2
            const loser = game.p1_wins > game.p2_wins ? game.p2 : game.p1
            resultMsg += `\n\n🏆 *Финальный результат*:\n${game.p1}: ${game.p1_wins} побед\n${game.p2}: ${game.p2_wins} побед\n\n👑 ${winner} ПОБЕДИЛ СЕРИЮ!`
            
            await updateStats(winner, 'rps', 'win')
            await updateStats(loser, 'rps', 'lose')
            delete sessions[gid]
        } else {
            game.round++
            game.p1_choice = null
            game.p2_choice = null
            resultMsg += `\n\n📊 Счёт: ${game.p1} ${game.p1_wins} - ${game.p2_wins} ${game.p2}\n\nРаунд ${game.round}/${game.max_rounds}. Выбери: .rps choice <камень|ножницы|бумага>`
        }
        
        // Send result to both players
        reply(resultMsg)
        if (client) {
            try {
                const otherPlayer = sender === game.p1 ? game.p2 : game.p1
                await client.sendMessage(toUserJid(otherPlayer), { text: resultMsg })
            } catch (e) {
                console.error('[GAME] Error sending RPS result:', e.message)
            }
        }
    }
    
    return true
}

async function handleRPSDecline(sender, reply, client, jid) {
    if (pendingInvites[sender]) {
        const inviter = pendingInvites[sender].invited_by
        if (pendingInvites[sender].game !== 'rps') {
            return reply('❌ Нет активного приглашения в РПС')
        }
        delete pendingInvites[sender]
        const declineMsg = `❌ ${sender} отклонил приглашение в РПС`
        reply(declineMsg)
        
        // Notify inviter if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(inviter), { text: declineMsg })
            } catch (e) {
                console.error('[GAME] Error sending RPS decline:', e.message)
            }
        }
        return true
    }
    return reply('❌ Нет активного приглашения')
}

// ===== GUESS MULTIPLAYER =====
async function handleGuessInvite(sender, target, reply, client, jid) {
    if (!target) return reply('Укажите @участника')
    
    // Extract phone from @mention or direct number
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'guess', invited_by: sender, expires_at: now() + INVITE_TIMEOUT }
    
    // Send invite to target's DM if client is available
    if (client) {
        try {
            const inviteMsg = `🎮 ${sender} приглашает тебя в Guess!\n\nПримери: .guess accept ${sender}`
            await client.sendMessage(toUserJid(targetPhone), { text: inviteMsg })
        } catch (e) {
            console.error('[GAME] Error sending Guess invite:', e.message)
        }
    }
    
    reply(`📬 Приглашение отправлено @${targetPhone}`)
    return true
}

async function handleGuessAccept(sender, inviter, reply, client, jid) {
    // Extract phone from @mention or direct number
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    const gid = getGameId(sender, inviterPhone)
    sessions[gid] = {
        game: 'guess',
        guesser: sender,
        secret_number: null,
        tries: 0,
        max_tries: 15
    }
    delete pendingInvites[sender]
    
    const startMsg = `✅ Игра началась! ${inviterPhone} загадывает число от 1 до 30.\n\n${inviterPhone}: .guess number <число>`
    reply(startMsg)
    
    // Send to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: startMsg })
        } catch (e) {
            console.error('[GAME] Error sending Guess start:', e.message)
        }
    }
    
    return true
}

async function handleGuessSetNumber(sender, numStr, reply, client, jid) {
    const num = parseInt(numStr)
    if (isNaN(num) || num < 1 || num > 30) return reply('❌ Число от 1 до 30')
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'guess' && (g.guesser === sender || id.includes(sender))) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в Guess игре')
    
    game.secret_number = num
    const other = gid.split('+').find(p => p !== sender)
    const readyMsg = `✅ Число загадано! ${other}, теперь твоя очередь угадывать (15 попыток).\n\nКоманда: .guess guess <число>`
    reply(readyMsg)
    
    // Send to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(other), { text: readyMsg })
        } catch (e) {
            console.error('[GAME] Error sending Guess ready:', e.message)
        }
    }
    
    return true
}

async function handleGuessGuess(sender, numStr, reply, client, jid) {
    const guess = parseInt(numStr)
    if (isNaN(guess) || guess < 1 || guess > 30) return reply('❌ Число от 1 до 30')
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'guess' && (g.guesser === sender || id.includes(sender))) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в Guess игре')
    if (!game.secret_number) return reply('❌ Число ещё не загадано')
    
    game.tries++
    
    if (guess === game.secret_number) {
        const guesser = game.guesser
        const other = gid.split('+').find(p => p !== guesser)
        await updateStats(guesser, 'guess', 'win')
        await updateStats(other, 'guess', 'lose')
        delete sessions[gid]
        
        const winMsg = `🎉 ВЕРНО за ${game.tries} попыток! ${guesser} победил!`
        reply(winMsg)
        
        // Send to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(other), { text: winMsg })
            } catch (e) {
                console.error('[GAME] Error sending Guess win:', e.message)
            }
        }
        return true
    }
    
    if (game.tries >= game.max_tries) {
        const secret = game.secret_number
        const guesser = game.guesser
        const other = gid.split('+').find(p => p !== guesser)
        await updateStats(other, 'guess', 'win')
        await updateStats(guesser, 'guess', 'lose')
        delete sessions[gid]
        
        const loseMsg = `❌ Попытки закончились! Число было ${secret}. ${other} победил!`
        reply(loseMsg)
        
        // Send to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(other), { text: loseMsg })
            } catch (e) {
                console.error('[GAME] Error sending Guess lose:', e.message)
            }
        }
        return true
    }
    
    const hint = guess < game.secret_number ? '📈 БОЛЬШЕ' : '📉 МЕНЬШЕ'
    const hintMsg = `${hint} | Попыток: ${game.tries}/${game.max_tries}`
    reply(hintMsg)
    
    // Send hint to other player if client is available
    if (client) {
        try {
            const other = gid.split('+').find(p => p !== sender)
            await client.sendMessage(toUserJid(other), { text: `${sender} сделал попытку: ${guess} → ${hintMsg}` })
        } catch (e) {
            console.error('[GAME] Error sending Guess hint:', e.message)
        }
    }
    
    return true
}

// ===== HANGMAN MULTIPLAYER =====
async function handleHangmanInvite(sender, target, reply, client, jid) {
    if (!target) return reply('Укажите @участника')
    
    // Extract phone from @mention or direct number
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'hangman', invited_by: sender, expires_at: now() + INVITE_TIMEOUT }
    
    // Send invite to target's DM if client is available
    if (client) {
        try {
            const inviteMsg = `🎮 ${sender} приглашает тебя в Hangman!\n\nПримери: .hangman accept ${sender}`
            await client.sendMessage(toUserJid(targetPhone), { text: inviteMsg })
        } catch (e) {
            console.error('[GAME] Error sending Hangman invite:', e.message)
        }
    }
    
    reply(`📬 Приглашение отправлено @${targetPhone}`)
    return true
}

async function handleHangmanAccept(sender, inviter, reply, client, jid) {
    // Extract phone from @mention or direct number
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    const gid = getGameId(sender, inviterPhone)
    sessions[gid] = {
        game: 'hangman',
        guesser: sender,
        word: null,
        guessed: [],
        mistakes: 0,
        max_mistakes: 6
    }
    delete pendingInvites[sender]
    
    const startMsg = `✅ Игра началась! ${inviterPhone} загадывает слово.\n\n${inviterPhone}: .hangman word <слово>`
    reply(startMsg)
    
    // Send to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: startMsg })
        } catch (e) {
            console.error('[GAME] Error sending Hangman start:', e.message)
        }
    }
    
    return true
}

async function handleHangmanWord(sender, word, reply, client, jid) {
    const w = word.toLowerCase()
    if (w.length < 3) return reply('❌ Слово минимум 3 буквы')
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'hangman' && (g.guesser === sender || id.includes(sender))) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в Hangman игре')
    
    game.word = w
    const masked = '_'.repeat(w.length)
    const other = gid.split('+').find(p => p !== sender)
    
    const readyMsg = `✅ Слово загадано!\n${other}, отгадывай: ${masked}\n\nКоманда: .hangman guess <буква>`
    reply(readyMsg)
    
    // Send to other player if client is available
    if (client) {
        try {
            await client.sendMessage(toUserJid(other), { text: readyMsg })
        } catch (e) {
            console.error('[GAME] Error sending Hangman ready:', e.message)
        }
    }
    
    return true
}

async function handleHangmanGuess(sender, letter, reply, client, jid) {
    const ch = letter.toLowerCase()
    if (!/^[а-яa-z]$/.test(ch)) return reply('❌ Одна буква')
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(sessions)) {
        if (g.game === 'hangman' && (g.guesser === sender || id.includes(sender))) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в Hangman игре')
    if (!game.word) return reply('❌ Слово ещё не загадано')
    if (game.guessed.includes(ch)) return reply('❌ Уже такая буква была')
    
    game.guessed.push(ch)
    
    if (!game.word.includes(ch)) {
        game.mistakes++
    }
    
    const masked = game.word.split('').map(l => game.guessed.includes(l) ? l : '_').join(' ')
    
    if (game.word.split('').every(l => game.guessed.includes(l))) {
        const guesser = game.guesser
        const other = gid.split('+').find(p => p !== guesser)
        await updateStats(guesser, 'hangman', 'win')
        await updateStats(other, 'hangman', 'lose')
        delete sessions[gid]
        
        const winMsg = `🎉 ПОБЕДА!\nСлово: ${game.word}\n${guesser} отгадал!`
        reply(winMsg)
        
        // Send to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(other), { text: winMsg })
            } catch (e) {
                console.error('[GAME] Error sending Hangman win:', e.message)
            }
        }
        return true
    }
    
    if (game.mistakes >= game.max_mistakes) {
        const word = game.word
        const guesser = game.guesser
        const other = gid.split('+').find(p => p !== guesser)
        await updateStats(other, 'hangman', 'win')
        await updateStats(guesser, 'hangman', 'lose')
        delete sessions[gid]
        
        const loseMsg = `❌ ПРОИГРАЛИ!\nСлово было: ${word}\n${other} победил!`
        reply(loseMsg)
        
        // Send to other player if client is available
        if (client) {
            try {
                await client.sendMessage(toUserJid(guesser), { text: loseMsg })
            } catch (e) {
                console.error('[GAME] Error sending Hangman lose:', e.message)
            }
        }
        return true
    }
    
    const guessMsg = `${masked}\n❌ Ошибки: ${game.mistakes}/${game.max_mistakes}`
    reply(guessMsg)
    
    // Send progress to other player if client is available
    if (client) {
        try {
            const other = gid.split('+').find(p => p !== sender)
            await client.sendMessage(toUserJid(other), { text: `${sender} выбрал букву "${ch}":\n\n${guessMsg}` })
        } catch (e) {
            console.error('[GAME] Error sending Hangman progress:', e.message)
        }
    }
    
    return true
}

// ===== SINGLE PLAYER GAMES =====
async function handleSingleGame(sender, cmd, args, reply) {
    if (cmd === 'quiz') {
        const pool = [
            {q:'Столица Франции?', a:'париж'},
            {q:'2+2*2 = ?', a:'6'},
            {q:'Язык на котором работает Node.js?', a:'javascript'}
        ]
        if (args[0] === 'start' || !sessions[sender] || sessions[sender].game !== 'quiz') {
            const item = pool[rand(0, pool.length-1)]
            sessions[sender] = { game: 'quiz', item }
            return reply(`❓ ${item.q}\nОтвет: .quiz answer <текст>`)
        }
        if (args[0] === 'answer') {
            if (!sessions[sender] || sessions[sender].game !== 'quiz') return reply('Сначала: .quiz start')
            const ans = args.slice(1).join(' ').toLowerCase()
            if (!ans) return reply('Укажите ответ')
            const correct = sessions[sender].item.a.toLowerCase()
            const ok = ans === correct
            delete sessions[sender]
            return reply(ok ? '✅ Правильно!' : `❌ Неправильно. Ответ: ${correct}`)
        }

        return reply('Команды: .quiz start | .quiz answer <текст>')
    }
    
    if (cmd === 'scramble') {
        const words = ['engine','computer','program','node','whatsapp']
        if (args[0] === 'start' || !sessions[sender] || sessions[sender].game !== 'scramble') {
            const w = words[rand(0, words.length-1)]
            const scrambled = w.split('').sort(() => Math.random()-0.5).join('')
            sessions[sender] = { game: 'scramble', word: w }
            return reply(`🔤 Расшифруй: ${scrambled}\nОтвет: .scramble guess <слово>`)
        }
        if (args[0] === 'guess') {
            if (!sessions[sender] || sessions[sender].game !== 'scramble') return reply('Сначала: .scramble start')
            const g = args[1]?.toLowerCase()
            if (!g) return reply('Укажите слово')
            const ok = g === sessions[sender].word
            delete sessions[sender]
            return reply(ok ? '✅ Верно!' : `❌ Неверно. Было: ${sessions[sender].word}`)
        }
        return reply('Команды: .scramble start | .scramble guess <слово>')
    }
    
    return false
}
