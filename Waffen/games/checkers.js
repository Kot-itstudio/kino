import { updateStats, addBalance } from '../db.js'

const checkersGames = {}
const pendingInvites = {}

const getGameId = (p1, p2) => [p1, p2].sort().join('+')
const getPhoneFromJID = (jid) => jid?.match(/^(\d+)@/)?.[1] || jid
const toUserJid = (phone) => {
    if (!phone) return phone
    if (phone.includes('@')) return phone
    const digits = phone.replace(/\D/g, '')
    return `${digits}@s.whatsapp.net`
}

// Инициализация доски (8x8)
function initBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(0))
    
    // Расставляем фишки игрока 1 (белые) - 0, 2
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) board[r][c] = 1
        }
    }
    
    // Расставляем фишки игрока 2 (черные) - 5, 7
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) board[r][c] = 2
        }
    }
    
    return board
}

function renderBoard(board) {
    let display = '   0 1 2 3 4 5 6 7\n'
    for (let r = 0; r < 8; r++) {
        display += `${r} `
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 0) {
                display += '⬜'
            } else {
                if (board[r][c] === 1) display += '⚪'
                else if (board[r][c] === 2) display += '⚫'
                else display += '◻️'
            }
        }
        display += '\n'
    }
    return '```\n' + display + '```'
}

export async function handleCheckers(sender, cmd, args, reply, client, jid) {
    const cmdLower = cmd.toLowerCase()
    
    if (cmdLower !== 'checkers') return false
    
    if (args[0] === 'invite' && args[1]) {
        return handleCheckersInvite(sender, args[1], reply, client, jid)
    }
    if (args[0] === 'accept' && args[1]) {
        return handleCheckersAccept(sender, args[1], reply, client, jid)
    }
    if (args[0] === 'decline') {
        return handleCheckersDecline(sender, reply, client, jid)
    }
    if (args[0] === 'move' && args[1] && args[2]) {
        return handleCheckersMove(sender, args[1], args[2], reply, client, jid)
    }
    
    reply('Использование: .checkers invite @юзер | .checkers accept @юзер | .checkers decline | .checkers move <0-7> <0-7>')
    return true
}

function handleCheckersInvite(sender, target, reply, client, jid) {
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'checkers', invited_by: sender }
    reply(`📬 Приглашение отправлено @${targetPhone}`)
    return true
}

async function handleCheckersAccept(sender, inviter, reply, client, jid) {
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    
    const gid = getGameId(sender, inviterPhone)
    checkersGames[gid] = {
        game: 'checkers',
        p1: inviterPhone,
        p2: sender,
        board: initBoard(),
        turn: inviterPhone
    }
    delete pendingInvites[sender]
    
    const boardMsg = `✅ Игра началась!\n\n${renderBoard(checkersGames[gid].board)}\n\nХод ${inviterPhone} (белые)\n\n.checkers move <от> <до>`
    reply(boardMsg)
    
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: boardMsg })
        } catch (e) {
            console.error('[CHECKERS] Error:', e.message)
        }
    }
    return true
}

function handleCheckersDecline(sender, reply, client, jid) {
    if (pendingInvites[sender]) {
        delete pendingInvites[sender]
        reply('❌ Приглашение отклонено')
        return true
    }
    reply('Нет активного приглашения')
    return true
}

async function handleCheckersMove(sender, fromStr, toStr, reply, client, jid) {
    // Parse move: "0123" or "01 23"
    const from = parseInt(fromStr)
    const to = parseInt(toStr)
    
    if (isNaN(from) || isNaN(to) || from < 0 || from > 63 || to < 0 || to > 63) {
        return reply('❌ Используйте: .checkers move <0-63> <0-63>')
    }
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(checkersGames)) {
        if (g.game === 'checkers' && (g.p1 === sender || g.p2 === sender)) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в игре шашек')
    if (game.turn !== sender) return reply('❌ Сейчас не ваш ход')
    
    const fromRow = Math.floor(from / 8)
    const fromCol = from % 8
    const toRow = Math.floor(to / 8)
    const toCol = to % 8
    
    // Простая проверка валидности хода
    if (Math.abs(fromRow - toRow) !== 1 || Math.abs(fromCol - toCol) !== 1) {
        return reply('❌ Неверный ход')
    }
    
    const playerNum = sender === game.p1 ? 1 : 2
    if (game.board[fromRow][fromCol] !== playerNum) {
        return reply('❌ Это не ваша фишка')
    }
    
    if (game.board[toRow][toCol] !== 0) {
        return reply('❌ Клетка занята')
    }
    
    game.board[toRow][toCol] = game.board[fromRow][fromCol]
    game.board[fromRow][fromCol] = 0
    
    // Проверяем победу (если нет фишек у противника)
    game.turn = sender === game.p1 ? game.p2 : game.p1
    const boardMsg = `${renderBoard(game.board)}\n\nХод ${game.turn}`
    reply(boardMsg)
    
    if (client) {
        try {
            const otherPlayer = sender === game.p1 ? game.p2 : game.p1
            await client.sendMessage(toUserJid(otherPlayer), { text: boardMsg })
        } catch (e) {
            console.error('[CHECKERS] Error:', e.message)
        }
    }
    
    return true
}

export default handleCheckers
