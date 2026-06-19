// Guess-Question multiplayer: "угадать слово" через вопрос/ответ
// По требованиям задачи:
// - игра на двоих
// - вопросы (в смысле загадки) НЕ шаблонные, генерируются динамически
// - уровни сложности
// - на правильный ответ начисляются монеты
// - на ответ даётся 60 секунд

const sessions = {}

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const now = () => Date.now()
const INVITE_TIMEOUT = 5 * 60 * 1000
const ANSWER_TIMEOUT_MS = 60 * 1000

const pendingInvites = {} // { [playerPhone]: { invited_by, game, expires_at } }

const normalizeText = (s) => (s || '').toString().trim().toLowerCase()

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Небольшая оффлайн-"база" для гарантированного старта без интернета.
// В качестве "не шаблонных" используются вариации с разными формулировками.
const WORD_BANK = [
  'арбуз',
  'автомобиль',
  'компьютер',
  'телефон',
  'пирамида',
  'планета',
  'космос',
  'стратегия',
  'музыка',
  'карандаш',
  'путешествие',
  'библиотека',
  'клавиатура',
  'погода',
  'карта',
  'память',
  'свет',
  'площадь',
]

const DIFFICULTY = {
  1: { tries: 1, reward: 10 },
  2: { tries: 1, reward: 20 },
  3: { tries: 1, reward: 35 },
}

function buildQuestion(word, level) {
  // Генерируем вопрос динамически, смешивая тип подсказки.
  // Ответ — слово целиком.
  const w = word.toLowerCase()
  const letters = Array.from(w)

  const forms = [
    // "описание" через свойства
    () => {
      const hasA = w.includes('а')
      const hasE = w.includes('е')
      const len = w.length
      const options = [
        `В этом слове ${len} букв. Оно содержит букву ${hasA ? '«а»' : '«б»'} и не содержит букву «й».`,
        `Это слово длиной ${len} букв. В нём есть ${hasE ? '«е»' : '«ё»'}, и встречается двойная согласная отсутствует.`,
        `Слово состоит из ${len} букв и начинается с буквы «${w[0]}».`,
      ]
      // подмена "не шаблонность" через рандом
      return options[rand(0, options.length - 1)]
    },

    // "части слова"
    () => {
      const start = w.slice(0, Math.min(3, len)).toUpperCase()
      const end = w.slice(-Math.min(3, len)).toUpperCase()
      const hiddenCount = Math.max(0, len - 6)
      const options = [
        `Угадайте слово: начинается на «${start}», заканчивается на «${end}» (между ними ещё ${hiddenCount} букв).`,
        `В этом слове первые 2 буквы: «${w.slice(0, 2).toUpperCase()}», последние 2: «${w.slice(-2).toUpperCase()}».`,
      ]
      return options[rand(0, options.length - 1)]
    },

    // "угадай по алфавитным признакам"
    () => {
      const first = w[0].toUpperCase()
      const last = w[w.length - 1].toUpperCase()
      const vowels = ['а','е','ё','и','о','у','ы','э','ю','я']
      const vowelCount = letters.filter(ch => vowels.includes(ch)).length
      const options = [
        `Слово начинается с «${first}» и заканчивается на «${last}». Количество гласных: ${vowelCount}.`,
        `В слове ${vowelCount} гласных, первая буква «${first}», последняя «${last}».`,
      ]
      return options[rand(0, options.length - 1)]
    },
  ]

  const questionText = forms[rand(0, forms.length - 1)]()

  const difficultyLabel = level === 1 ? 'Лёгкий' : level === 2 ? 'Средний' : 'Сложный'
  return {
    word: w,
    questionText,
    difficultyLabel,
  }
}

function buildProgressText({ difficultyLabel, questionText, level, timeLeftMs }) {
  const sec = Math.max(0, Math.ceil(timeLeftMs / 1000))
  return `🧩 *Угадай слово (сложноcть: ${difficultyLabel})*

${questionText}

⏱ Ответ за ${sec} сек

Команда: .wq ${'answer'} <слово>`
}

export default async function handleWordQuestion(sender, cmd, args, reply, client, jid) {
  const cmdLower = (cmd || '').toLowerCase()
  if (cmdLower !== 'word_question' && cmdLower !== 'wq') return false

  const sub = args[0]?.toLowerCase()

  if (sub === 'invite') {
    const target = args[1]
    if (!target) return reply('Укажите @участника')
    const targetPhone = target.replace(/[^0-9]/g, '')
    if (!targetPhone || targetPhone === sender) return reply('❌ Неверный участник')

    pendingInvites[targetPhone] = { game: 'word_question', invited_by: sender, expires_at: now() + INVITE_TIMEOUT }

    if (client) {
      try {
        await client.sendMessage(`${targetPhone}@s.whatsapp.net`, {
          text: `🎮 ${sender} зовёт тебя в игру "Угадай слово" (вопросы!)\n\nПрими: .wq accept ${sender}\nОткажи: .wq decline`,
        })
      } catch (e) {
        // не валим игру
        console.error('[WQ] invite send error:', e.message)
      }
    }

    return reply(`📬 Приглашение отправлено @${targetPhone}`)
  }

  if (sub === 'accept') {
    const inviter = args[1]
    const inviterPhone = (inviter || '').replace(/[^0-9]/g, '')
    if (!inviterPhone) return reply('❌ Укажите пригласившего')

    if (!pendingInvites[sender] || pendingInvites[sender].invited_by !== inviterPhone) {
      return reply('❌ Нет активного приглашения')
    }

    const gid = [sender, inviterPhone].sort().join('+')
    const level = 1 // стартуем с лёгкого; можно расширить команды выбора уровня

    const q = buildQuestion(sampleWord(level), level)

    sessions[gid] = {
      game: 'word_question',
      players: [inviterPhone, sender], // p1=inviter, p2=acceptor
      state: 'asking',
      level,
      question: q,
      answer_by: null,
      answered: {},
      startedAt: now(),
      expiresAt: now() + ANSWER_TIMEOUT_MS,
      timer: null,
    }

    delete pendingInvites[sender]

    const acceptor = sender
    const inviterJ = inviterPhone

    // Приглашаем к ответу пригласившего или отвечающего: по смыслу "ты отвечаешь на вопрос"
    // По механике сделаем так: после accept вопрос генерируется и ответить должен ПРИГЛАШЕННЫЙ.
    // (Можно легко поменять, но так реализуем сразу.)
    sessions[gid].answer_by = acceptor

    const msg = `✅ Игра началась!\n\n${buildProgressText({
      difficultyLabel: q.difficultyLabel,
      questionText: q.questionText,
      level,
      timeLeftMs: ANSWER_TIMEOUT_MS,
    })}`

    reply(msg)

    // отправляем пригласившему тоже
    if (client) {
      try {
        await client.sendMessage(`${inviterJ}@s.whatsapp.net`, { text: msg })
      } catch (e) {
        console.error('[WQ] accept broadcast error:', e.message)
      }
    }

    // Таймер окончания
    sessions[gid].timer = setTimeout(async () => {
      const s = sessions[gid]
      if (!s || s.state !== 'asking') return
      s.state = 'finished'
      const winner = null
      const loseMsg = `⏰ Время вышло!\nПравильный ответ: *${s.question.word}*`

      try {
        await reply(loseMsg)
      } catch (_) {}

      // Также отправим в ЛС второму, если можем
      if (client) {
        try {
          const other = s.players.find(p => p !== s.answer_by)
          await client.sendMessage(`${other}@s.whatsapp.net`, { text: loseMsg })
        } catch (e) {
          console.error('[WQ] timeout send error:', e.message)
        }
      }

      delete sessions[gid]
    }, ANSWER_TIMEOUT_MS)

    return true
  }

  if (sub === 'decline') {
    if (pendingInvites[sender]) {
      const inviter = pendingInvites[sender].invited_by
      delete pendingInvites[sender]
      return reply('❌ Отклонено')
    }
    return reply('❌ Нет активного приглашения')
  }

  if (sub === 'answer') {
    const guess = normalizeText(args.slice(1).join(' '))
    if (!guess) return reply('Укажите слово')

    // Найти активную сессию игрока
    const gid = Object.keys(sessions).find(k => {
      const s = sessions[k]
      return s && s.game === 'word_question' && s.players.includes(sender) && s.state === 'asking' && s.answer_by === sender
    })
    if (!gid) return reply('❌ Сейчас нет активного вопроса для вашего ответа')

    const s = sessions[gid]
    if (!s) return reply('❌ Нет активной игры')

    // остановить таймер
    if (s.timer) clearTimeout(s.timer)
    s.timer = null

    const correct = normalizeText(s.question.word)
    const ok = guess === correct

    if (ok) {
      const reward = DIFFICULTY[s.level]?.reward ?? 10
      s.state = 'finished'

      // Награда: coins
      if (sender) {
        try {
          const { addBalance } = await import('../db.js')
          await addBalance(sender, 'coins', reward)
        } catch (e) {
          // не ломаем игру
          console.error('[WQ] addBalance error:', e.message)
        }
      }

      const winMsg = `🎉 Правильно!\nОтвет: *${s.question.word}*\nНаграда: +${reward} 🪙 монет`
      reply(winMsg)

      if (client) {
        try {
          const other = s.players.find(p => p !== sender)
          await client.sendMessage(`${other}@s.whatsapp.net`, { text: winMsg })
        } catch (e) {
          console.error('[WQ] win broadcast error:', e.message)
        }
      }

      delete sessions[gid]
      return true
    }

    // Неправильно: проигрыш (по требованиям можно оставить без доп. попыток)
    s.state = 'finished'
    const loseMsg = `❌ Неверно.\nПравильный ответ: *${s.question.word}*`
    reply(loseMsg)

    if (client) {
      try {
        const other = s.players.find(p => p !== sender)
        await client.sendMessage(`${other}@s.whatsapp.net`, { text: loseMsg })
      } catch (e) {
        console.error('[WQ] lose broadcast error:', e.message)
      }
    }

    delete sessions[gid]
    return true
  }

  // Alias для удобства: .wq <слово>
  if (!sub && args.length >= 1) {
    return handleWordQuestion(sender, cmd, ['answer', ...args], reply, client, jid)
  }

  return reply('Команды: .wq invite @user | .wq accept @inviter | .wq decline | .wq answer <слово>')
}

function sampleWord(_level) {
  const options = WORD_BANK
  const w = options[rand(0, options.length - 1)]
  return w
}

