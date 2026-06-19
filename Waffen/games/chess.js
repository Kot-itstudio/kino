import { updateStats, addBalance } from '../db.js'

const chessGames = {}
const pendingInvites = {}

const getGameId = (p1, p2) => [p1, p2].sort().join('+')
const toUserJid = (phone) => {
    if (!phone) return phone
    if (phone.includes('@')) return phone
    const digits = phone.replace(/\D/g, '')
    return `${digits}@s.whatsapp.net`
}

const pieces = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

// Упрощенная доска
function initBoard() {
    return [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ]
}

function posToCoords(pos) {
    if (pos.length !== 2) return null
    const col = pos.charCodeAt(0) - 97 // a-h -> 0-7
    const row = 8 - parseInt(pos[1]) // 8-1 -> 0-7
    if (col < 0 || col > 7 || row < 0 || row > 7) return null
    return { row, col }
}

function renderBoard(board) {
    let display = '   a b c d e f g h\n'
    for (let r = 0; r < 8; r++) {
        display += `${8 - r} `
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c]
            if (piece === '.') {
                display += (r + c) % 2 === 0 ? '⬜' : '⬛'
            } else {
                display += pieces[piece] || piece
            }
        }
        display += '\n'
    }
    return '```\n' + display + '```'
}

export async function handleChess(sender, cmd, args, reply, client, jid) {
    const cmdLower = cmd.toLowerCase()
    
    if (cmdLower !== 'chess') return false
    
    if (args[0] === 'invite' && args[1]) {
        return handleChessInvite(sender, args[1], reply, client, jid)
    }
    if (args[0] === 'accept' && args[1]) {
        return handleChessAccept(sender, args[1], reply, client, jid)
    }
    if (args[0] === 'decline') {
        return handleChessDecline(sender, reply, client, jid)
    }
    if (args[0] === 'move' && args[1]) {
        return handleChessMove(sender, args[1], args[2], reply, client, jid)
    }
    
    reply('Использование: .chess invite @юзер | .chess accept @юзер | .chess decline | .chess move <e2e4>')
    return true
}

function handleChessInvite(sender, target, reply, client, jid) {
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')
    
    pendingInvites[targetPhone] = { game: 'chess', invited_by: sender }
    reply(`📬 Приглашение отправлено @${targetPhone}`)
    return true
}

async function handleChessAccept(sender, inviter, reply, client, jid) {
    const inviterPhone = inviter.replace(/[^0-9]/g, '')
    
    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
        return reply('❌ Нет активного приглашения')
    }
    
    const gid = getGameId(sender, inviterPhone)
    chessGames[gid] = {
        game: 'chess',
        p1: inviterPhone,
        p2: sender,
        board: initBoard(),
        turn: inviterPhone, // white starts
        moves: []
    }
    delete pendingInvites[sender]
    
    const boardMsg = `✅ Игра началась!\n\n${renderBoard(chessGames[gid].board)}\n\nБелые (${inviterPhone}): ваш ход\n\n.chess move <e2e4>`
    reply(boardMsg)
    
    if (client) {
        try {
            await client.sendMessage(toUserJid(inviterPhone), { text: boardMsg })
        } catch (e) {
            console.error('[CHESS] Error:', e.message)
        }
    }
    return true
}

function handleChessDecline(sender, reply, client, jid) {
    if (pendingInvites[sender]) {
        delete pendingInvites[sender]
        reply('❌ Приглашение отклонено')
        return true
    }
    reply('Нет активного приглашения')
    return true
}

async function handleChessMove(sender, fromPos, toPos, reply, client, jid) {
    if (!fromPos || !toPos) {
        return reply('❌ Используйте: .chess move <e2e4>')
    }
    
    const moveStr = fromPos + toPos
    if (moveStr.length !== 4) {
        return reply('❌ Неверный формат хода')
    }
    
    const from = posToCoords(moveStr.substring(0, 2))
    const to = posToCoords(moveStr.substring(2, 4))
    
    if (!from || !to) {
        return reply('❌ Неверные координаты')
    }
    
    let gid = null, game = null
    for (const [id, g] of Object.entries(chessGames)) {
        if (g.game === 'chess' && (g.p1 === sender || g.p2 === sender)) {
            gid = id
            game = g
            break
        }
    }
    
    if (!game) return reply('❌ Вы не участвуете в игре шахмат')
    if (game.turn !== sender) return reply('❌ Сейчас не ваш ход')
    
    const piece = game.board[from.row][from.col]
    if (piece === '.') return reply('❌ Нет фишки на этой клетке')
    
    // Проверяем, что это фишка нужного цвета
    const isWhite = piece === piece.toUpperCase()
    const playerIsWhite = sender === game.p1
    if (isWhite !== playerIsWhite) return reply('❌ Это не ваша фишка')
    
    // Простой ход без полной проверки возможности
    const targetPiece = game.board[to.row][to.col]
    if (targetPiece !== '.') {
        const targetIsWhite = targetPiece === targetPiece.toUpperCase()
        if (targetIsWhite === isWhite) return reply('❌ На этой клетке ваша фишка')
    }
    
    game.board[to.row][to.col] = piece
    game.board[from.row][from.col] = '.'
    game.moves.push(moveStr)
    
    game.turn = sender === game.p1 ? game.p2 : game.p1
    const otherPlayer = sender === game.p1 ? game.p2 : game.p1
    
    const boardMsg = `${renderBoard(game.board)}\n\nХод ${otherPlayer}`
    reply(boardMsg)
    
    if (client) {
        try {
            await client.sendMessage(toUserJid(otherPlayer), { text: boardMsg })
        } catch (e) {
            console.error('[CHESS] Error:', e.message)
        }
    }
    
    return true
}

export default handleChess
