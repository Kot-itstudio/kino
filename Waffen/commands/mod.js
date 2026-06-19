import { getModData, updateStats, getUserInfo, addBalance, removeBalance, getBalance } from '../db.js'
import handleGames from '../games/index.js'
import logger from '../lib/logger.js'

const getPhoneFromJID = (jid) => {
    const match = jid.match(/^(\d+)@/)
    return match ? match[1] : jid
}

const sendReply = async (client, msg, chatId, text, buttons = null) => {
    try {
        const payload = { text }
        if (buttons) {
            payload.contextInfo = {
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: null,
            }
        }
        await client.sendMessage(chatId, payload)
    } catch (e) {
        logger.error('[SEND ERROR]', e.message)
    }
}

const MENU_TEXT = `
🎮 *МЕНЮ КОМАНД WAFFENBOT* 🎮

═══════════════════════════════

🏓 *БАЗОВЫЕ КОМАНДЫ*:
  .ping / .пинг - проверка статуса + пинг (мс)
  .wallet / .кошелек - показать балланс
  .profile / .профиль - ваш профиль и статистика

═══════════════════════════════

🎯 *ОДИНОЧНЫЕ ИГРЫ:*
  ✂️ .rps <камень|ножницы|бумага> — РПС с ботом
  🎯 .emoji - угадай смайлик
  💬 .anon <сообщение> — отправить анонимное сообщение

═══════════════════════════════

👥 *ИГРЫ НА ДВОИХ:*

  ❌⭕ *КРЕСТИКИ-НОЛИКИ*
     .ttt i @юзер — пригласить
     .ttt a @пригласивший | .ttt decline — ответ
     .ttt m <1-9> — сделать ход

  🪨📄✂️ *РПС С ДРУГОМ*
     .rps i @юзер — начать серию
     .rps a @пригласивший | .rps decline
     .rps c <камень|ножницы|бумага> — выбор

  🔢 *УГАДАЙ ЧИСЛО*
     .guess i @юзер — начать игру
     .guess a @пригласивший
     .guess num <1-30> — загадать число
     .guess guess <число> — угадать

  🎪 *ВИСЕЛИЦА*
     .hangman i @юзер — начать
     .hangman a @пригласивший
     .hangman word <слово> — загадать слово
     .hangman guess <буква> — угадать букву

  ♟️ *ШАШКИ*
     .checkers i @юзер — начать
     .checkers a @пригласивший
     .checkers move <откуда> <куда> — ход

  ♔ *ШАХМАТЫ*
     .chess i @юзер — начать
     .chess a @пригласивший
     .chess m <e2e4> — ход (нотация)

═══════════════════════════════

👥 *ГРУППОВЫЕ ИГРЫ:*

  🔪 *МАФИЯ*
     .mafia create <кол-во игроков> — создать игру
     .mafia join — присоединиться
     .mafia start — начать
     .mafia vote @юзер — голосовать (день)
     .mafia kill @юзер — убить (ночь, только мафия)
     .mafia protect @юзер — защитить (ночь, только доктор)
     .mafia check @юзер — проверить (ночь, только комиссар)

═══════════════════════════════

💰 *ВАЛЮТЫ* 💰
  🪙 Монеты (базовая)
  💎 Драгоценности (редкие)
  🎫 Токены (специальные)
  🎟️ Билеты (лотерея)

═══════════════════════════════

❓ Вопросы? Напишите одному из разроботчиков:
- wa.me/79950115560
- wa.me/79527743088
👾 Приятной игры!
`

export default async (client, jid, sender, cmd, args, mentioned, msg, isGroup) => {

    logger.info(`cmd=${cmd}, number=${sender}, isGroup=${isGroup}`)


    try {
        let handled = false
        
        // PING - с отклонением (пинг)
        if (cmd === 'ping' || cmd === 'пинг') {
            logger.info('execute: ping')
            const startTime = Date.now()
            const startMsg = await client.sendMessage(jid, { text: '⏳ Отправка...' })
            const ping = Date.now() - startTime
            
            try {
                await client.sendMessage(jid, { text: `🏓 Pong! 📡 Пинг: ${ping}ms` })
            } catch (e) {
                logger.error('[PING] Error:', e.message)
            }
            return
        }
        
        // МЕНЮ
        else if (cmd === 'menu' || cmd === 'меню') {
            logger.info('execute: menu')
            await sendReply(client, msg, jid, MENU_TEXT)
            return
        }
        
        // КОШЕЛЕК
        else if (cmd === 'wallet' || cmd === 'кошелек') {
            logger.info('execute: wallet')
            const balance = await getBalance(sender)
            const walletText = `
💰 *ВАШЕ СОСТОЯНИЕ* 💰

🪙 Монеты: ${balance.coins}
💎 Драгоценности: ${balance.gems}
🎫 Токены: ${balance.tokens}
🎟️ Билеты: ${balance.tickets}

Заработайте валюту, играя в игры!
`
            await sendReply(client, msg, jid, walletText)
            return
        }
        
        // ПРОФИЛЬ
        else if (cmd === 'profile' || cmd === 'профиль') {
            logger.info('execute: profile')
            try {
                const user = await getUserInfo(sender)
                const balance = await getBalance(sender)
                const stats = user?.stats || {}
                const lastActive = user?.lastActive ? new Date(user.lastActive).toLocaleString('ru-RU') : 'N/A'
                const createdAt = user?.createdAt ? new Date(user.createdAt).toLocaleString('ru-RU') : 'N/A'
                
                const userJid = sender.includes('@') ? sender : `${sender}@s.whatsapp.net`
                let displayName = msg?.pushName || `User_${sender.slice(-4)}`
                
                const profileText = `📊 *ПРОФИЛЬ*

👤 Ник: *${displayName}*
📱 Номер: *+${sender}*

═══════════════════
💰 *КОШЕЛЕК*
🪙 Монеты: ${balance.coins}
💎 Драгоценности: ${balance.gems}
🎫 Токены: ${balance.tokens}
🎟️ Билеты: ${balance.tickets}

═══════════════════
🏆 *СТАТИСТИКА ИГР*

🎮 Всего побед: ${stats.games_won || 0}
😔 Поражений: ${stats.games_lost || 0}
🤝 Ничьих: ${stats.games_drawn || 0}

───────────────────
❌⭕ TTT: ${stats.ttt_wins || 0} побед
🪨📄✂️ РПС: ${stats.rps_wins || 0} побед
🔢 Угадай число: ${stats.guess_wins || 0} побед
🎪 Виселица: ${stats.hangman_wins || 0} побед
🔪 Мафия: ${stats.mafia_wins || 0} побед
♟️ Шашки: ${stats.checkers_wins || 0} побед
♔ Шахматы: ${stats.chess_wins || 0} побед
🎯 Смайлик: ${stats.emoji_wins || 0} побед

═══════════════════
📅 Участник с: ${createdAt}
🕐 Последняя активность: ${lastActive}`

                await sendReply(client, msg, jid, profileText)
            } catch (e) {
                logger.error('Ошибка в команде profile:', e.message)
                await sendReply(client, msg, jid, '❌ Ошибка получения информации профиля')
            }
            return
        }
        
        // Анонимные сообщения
        else if (cmd === 'anon' || cmd === 'анон') {
            logger.info('execute: anon')
            if (args.length === 0) {
                await sendReply(client, msg, jid, '❌ Использование: .anon <сообщение>')
                return
            }
            const anonMsg = args.join(' ')
            const sender_short = sender.slice(-4)
            
            if (isGroup) {
                await sendReply(client, msg, jid, `🤫 *АНОНИМНОЕ СООБЩЕНИЕ* 🤫\n\n"${anonMsg}"\n\n— Анонимный участник (ID: ${sender_short})`)
            } else {
                await sendReply(client, msg, jid, `🤫 *ВАШЕ АНОНИМНОЕ СООБЩЕНИЕ* 🤫\n\n"${anonMsg}"\n\nОтправлено анонимно!`)
            }
            
            // Даём награду за анонимные сообщения
            await addBalance(sender, 'coins', 5)
            await sendReply(client, msg, jid, '✅ +5 🪙 монет за анонимное сообщение!')
            return
        }
        
        // ЭМОДЗИ ГЕЙМ
        else if (cmd === 'emoji') {
            logger.info('execute: emoji')
            const gameReply = async (text) => await sendReply(client, msg, jid, text)
            await handleGames(sender, cmd, args, gameReply, client, jid)
            return
        }
        
        // ДРУГИЕ ИГРЫ - делегируем в games handler
        else {
            const gameReply = async (text) => await sendReply(client, msg, jid, text)
            const gh = await handleGames(sender, cmd, args, gameReply, client, jid)
            if (gh) return
        }
        
        // Команда не найдена
        logger.info(`denied: cmd=${cmd}`)
        await sendReply(client, msg, jid, `❌ Команда не найдена.\n\nИспользуйте .menu или .меню для списка команд`)
        
    } catch (e) {
        logger.error(`[CMD ERROR] ${cmd}:`, e.message)
        await sendReply(client, msg, jid, '❌ Ошибка выполнения команды')
    }
}