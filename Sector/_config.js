require('dotenv').config();
const fs = require('fs-extra');

global.MONGODB = process.env.MONGODB || "mongodb+srv://user1:EGG2AG3T@test.jyczdo6.mongodb.net/?retryWrites=true&w=majority&appName=test"
global.USE_PAIRING_CODE = process.env.USE_PAIRING_CODE === 'true'
global.THUMB_IMAGE = process.env.THUMB_IMAGE || "https://raw.githubusercontent.com/SecktorBot/Brandimages/main/logos/SocialLogo%201.png"
global.DEV = process.env.DEV === 'true'
global.PREFIX = process.env.PREFIX || "."
global.SUPPORT = process.env.SUPPORT || "79527743088"
global.ANTILINK = process.env.ANTILINK || "chat.whatsapp.com"
global.OWNERNUM = process.env.OWNERNUM || "79527743088@s.whatsapp.net"
global.OWNERNAME = process.env.OWNERNAME || "Secktor"

global.replies = {
	//========================================================== - Информация -
	ping: ({ status, ping }) => { if (status === 'start') { return '```Пинг!!!```'; } else { return `*Понг*\n *` + ping + ' мс*' } },
	restart: () => { return `Перезапуск...`; },

	infoBOT: ({ uptime, users, groups, sessions, useOZU, totalOZU, cpu, osType, osRelease, osArch }) => {
		let txt = `*🤖 БотИнфо:*\n\n` +
			`> •    _Время работы бота:_ ${uptime}\n` +
			`> •    _Пользуются ботом_ - ${users} users\n` +
			`> •    _Бот побывал в_ - ${groups} groups\n` +
			`> •    _Аккаунтов с ботом_ - ${sessions}\n\n` +

			`🔒 *Информация для создателя:*\n\n` +
			`> *💻 CPU Имя:*\n` +
			`> _${cpu}_\n\n` +

			`> 🖥️ ОЗУ: ${useOZU} / ${totalOZU}\n` +
			`> 🖥️ Тип ОС: ${osType}\n` +
			`> 📅 Версия ОС: ${osRelease}\n` +
			`> ⚙️ Архитектура: ${osArch}\n`;
		return txt
	},

	botStatus: ({ status }) => {
		if (status === 'on') {
			return `📢 *Информация*\n\n> Бот был активирован в данной группе...`;
		} else if (status === 'alreadyON') {
			return `📢 *Информация*\n\n> Бот уже был активирован в данной группе...`;
		} else if (status === 'alreadyOFF') {
			return `📢 *Информация*\n\n> Бот уже был деактивирован в данной группе...`
		} else {
			return `📢 *Информация*\n\n> Бот был деактивирован в данной группе...`;
		}
	},

	weather: ({ text, wdata }) => {
		let textw = "";
		textw += `*🌟Weather of  ${text}*\n\n`;
		textw += `*Weather:-* ${wdata.data.weather[0].main}\n`;
		textw += `*Description:-* ${wdata.data.weather[0].description}\n`;
		textw += `*Avg Temp:-* ${wdata.data.main.temp}\n`;
		textw += `*Feels Like:-* ${wdata.data.main.feels_like}\n`;
		textw += `*Pressure:-* ${wdata.data.main.pressure}\n`;
		textw += `*Humidity:-* ${wdata.data.main.humidity}\n`;
		textw += `*Humidity:-* ${wdata.data.wind.speed}\n`;
		textw += `*Latitude:-* ${wdata.data.coord.lat}\n`;
		textw += `*Longitude:-* ${wdata.data.coord.lon}\n`;
		textw += `*Country:-* ${wdata.data.sys.country}\n`;
		return textw;
	},

	code: ({ status, code }) => {
		if (status === 'generate') {
			return '🎲 Подключение бота...\n\n' +
				'> Мы готовим код и инструкцию для подключения бота на свой номер. Пожалуйста, ожидайте...';
		} else if (status === 'ready') {
			return '📙 Мы готовы к подключению бота!\n\n' +
				`> Ваш код: ${code}\n\n` +
				`> Инструкция:\n` +
				'> 1. Зайдите в WhatsApp на нужный номер\n' +
				'> 2. Нажмите на 3 точки (⋮)\n' +
				'> 3. Нажмите на "Связанные устройства"\n' +
				'> 4. Нажмите "Привязка устройства"\n' +
				'> 5. Если требуется, разблокируйте свой телефон\n' +
				'> 6. Нажмите "Привязка по номеру"\n' +
				'> 7. Введите в него: ' + code
		} else if (status === 'isNewLogin') {
			return '✅ Бот был успешно подключён!\n\n' +
				'🏠 Основные команды:\n' +
				'> .help - Посмотреть список команд\n' +
				'> .rank - Посмотреть статистику\n' +
				'> .gllb - Глобальная доска лидеров по msg\n\n' +
				'📚 Инструкция:\n' +
				'> *1. По желанию вы можете добавить бота в группу:*\n' +
				'> 2. Добавьте в описание группы строчку: \n' +
				'[ bot: номерБота@s.whatsapp.net ]\n' +
				'> 3. Приступайте к активному пользованию!\n\n' +
				'Если у вас возникают вопросы или проблемы сообщите об этом администрации бота, через .support';
		} else {
			return code;
		}
	},

	process: () => { return `🌎 *Информация*\n\n> Обработка вашего запроса, пожалуйста подождите...`; },
	endProcess: () => { return `> Обработка завершена...`; },
	priceEndProcess: (msg) => { return `> Обработка завершена, с вашего аккаунта было списано ${msg} msg`; },
	rulesBot: () => { return `📖 *Правила бота:*\n\n> Используя бота вы соглашаетесь, что мы не несём ответственность за ущерб, нанесённый вашему аккаунту или устройству.\n\n> *1.1* Спам/Флуд:\n> *Наказание*: Блокировка аккаунта на 7 дней \n\n> *1.2* Продажа MSG за реальную валюту\n> *Наказание*: ЧС Проекта\n\n> *1.3* Багоюз\n> *Наказание*: Блокировка аккаунта на 180 дней + Обнуление аккаунта\n\n> *1.4* Нанесение вреда проекту.\n> *Наказание:* ЧС проекта\n\n> *1.5* Расспростроение дизинформации о боте.\n> *Наказание:* Блокировка аккаунта на 30 дней` },
	games: ({ status, val }) => {
		if (status === 'notGame') {
			return `❗ *Ошибка*\n\n> Запущенной игры не найдено...`;
		} else if (status === 'delGame') {
			return `> Запущенная игра была успешно удалена, с вашего аккаунта было списано - ${val} MSG.`;
		} else if (status === 'delGameNotPrice') {
			return `> Запущенная игра была успешна удалена.`
		} else if (status === 'alreadyGame') {
			return `> Игра уже была запущена...`
		} else if (status === 'waiting') {
			return `🎲 Крестики-нолики\n\n> Ожидание второго игрока для начала игры...\n> Используйте .ttt ${val}, для присоединения к игре или .delttt для удаление текущей игры.`
		}
	},
	donate: ({ status, sumRUB, sumMSG, months, link }) => {
		if (status === 'default') {
			const a = ' '.padEnd(669.9)
			return `❓\n\n` +
				`> *.donate msg 1* - _покупка валюты MSG_\n` +
				`> *.donate vip 1* - _покупка VIP Статуса на 1 месяц_\n\n` +
				`${a}` +
				`_P.s Лучшая, Финансовая поддержка проекта - *2202206791758530 || 4100118049632781* -> by Воробушек 🦆_`

		} else if (status === 'msg') {
			return `✨ *Оплата создана*✨\n\n` +
				`> 💸 *Сумма:* ${sumRUB} RUB\n` +
				`> 💸 *Будет начислено:* ${sumMSG} msg\n` +
				`> 📎 *Ссылка для оплаты:*\n_${link}_\n\n` +
				`P.s После оплаты валюта MSG будет начислена на ваш аккаунт.`
		} else if (status === 'VIP') {
			return `✨ *Оплата создана*✨\n\n` +
				`> 💸 *Сумма:* ${sumRUB} RUB\n` +
				`> 💸 *Покупка:* VIP Status на ${months} месяц(ев)\n\n` +
				`> VIP Previev:\n` +
				`> 1. Повышенная ставка по депозиту\n` +
				`> 2. Переводы MSG больше 70000, через .givemymsg\n` +
				`> 2. Повышенные шансы в казино\n` +
				`> 3. Особый статус в Ранге\n` +
				`> 4. VIP Команды\n` +
				`> 5. Отключение возможной рекламы\n\n` +
				`> 📎 *Ссылка для оплаты:*\n_${link}_\n\n` +
				`_P.s После оплаты статус аккаунта автоматически изменится._`
		} else if (status === 'level') {
			return `✨ *Оплата создана*✨\n\n` +
				`> 💸 *Сумма:* ${sumRUB} RUB\n` +
				`> 💸 *Покупка:* Уровень\n` +
				`> 📎 *Ссылка для оплаты:*\n_${link}_\n\n` +
				`P.s После оплаты статус аккаунта автоматически изменится.`
		}
	},

	warn: ({ status, userId, gName }) => {
		if (status === 'rem') {
			return `Привет, @${userId}! У тебя уже три нарушения в ${gName}.\nИзвини, придется удалить тебя!`
		}
	},

	act: ({ status, priceMsg, priceLvl, senderLvl, senderMsg }) => {
		if (status === 'actAntilink') {
			return `📢 *Информация*\n\n> Antilink успешно активирован,с тебя было списано ${priceLvl} lvl, *у вас осталось ${senderLvl - priceLvl} lvl*`
		} else if (status === 'alreadyActAntilink') {
			return "📢 *Информация*\n\n> Antilink уже был активирован."
		} else if (status === 'actEvents') {
			return `📢 *Информация*\n\n> Успешно активировано *Events*, с тебя было списано ${priceLvl} lvl, *у вас осталось ${senderLvl - priceLvl} lvl*`
		} else if (status === 'alreadyActEvents') {
			return "📢 *Информация*\n\n> *Events* уже было активировано"
		} else if (status === 'actNsfw') {
			return "📢 *Информация*\n\n> Успешно активировано *NSFW*"
		} else if (status === 'alreadyActNsfw') {
			return "📢 *Информация*\n\n> *NSFW* уже было активировано"
		}
	},

	deact: ({ status, priceMsg, senderMsg }) => {
		if (status === 'deactAntilink') {
			return `📢 *Информация*\n\n> Антилинк успешно отключен`
		} else if (status === 'alreadyDeactAntilink') {
			return `📢 *Информация*\n\n> Антилинк уже был отключен`
		} else if (status === 'deactEvents') {
			return `📢 *Информация*\n\n> Приветствие/Прощания успешно отключены`
		} else if (status === 'alreadyDeactEvents') {
			return `📢 *Информация*\n\n> Приветствие/Прощания уже были отключены`
		} else if (status === 'deactNsfw') {
			return `📢 *Информация*\n\n> NSFW Успешно деактивировано, с вашего аккаунта было списано ${priceMsg} msg, у *у вас осталось ${senderMsg} msg*`
		} else if (status === 'alreadyDeactNsfw') {
			return `📢 *Информация*\n\n> NSFW Уже был отключен`
		}
	},

	tagadminsResponse: (groupAdmins, citel, text) => {
		let textt =
			`══✪〘   *Внимание(Админы)*   〙✪══\n\n` +
			`➲ *Сообщение :* ${text ? text : "blank"}\n\n` +
			`➲ *Автор:* ${citel.pushName} 🔖\n\n`;

		for (let mem of groupAdmins) {
			textt += `📍 @${mem.split("@")[0]}\n`;
		}

		return textt;
	},

	startBroadcast: (groupsCount) => {
		return `📢 *Информация*\n\n> Начата рассылка в ${groupsCount} групп. Время выполнения ${groupsCount * 1.5} секунд.`;
	},
	successBroadcast: (groupsCount) => {
		return `📢 *Информация*\n\n> Успешная рассылка в ${groupsCount} групп.`;
	},

	welcome: ({ status }) => {
		if (status === 'welcomeNew') {
			return `📢 *Информация*\n\n> Приветствие участников добавлено и включено в данной группе..`
		} else if (status === 'goodbyeNew') {
			return `📢 *Информация*\n\n> Прощание участников добавлено и включено в данной группе`
		} else if (status === 'welcomeOld') {
			return `✏️ *Изменение*\n\n> Приветствие участников обновлено//`
		} else if (status === 'goodbyeOld') {
			return `✏️ *Изменение*\n\n> Прощание участнкиов обновлено//`
		}
	},

	userBan: ({ reason, dateUnban }) => {
		return `❗ Нет прав\n\n> Ваш аккаунт заблокирован!\n> *Причина:* ${reason}\n> *Дата разблокировки:* ${dateUnban}\n\nP.s Поддержка - ${SUPPORT}`
	},

	forbidden: ({ status }) => {
		if (status === 'notBotGroup') {
			return `❗ *Ошибка*\n\n> Бот не работает в данной группе, подробнее у тебя в ЛС...`
		} else {
			return `❗ *Ошибка*\n\n> *_К сожалению эту команду невозможно использовать на ботах и на самом себе..._*`
		}
	},

	infoBotGroup: (num) => {
		return `> Для работы бота, необходимо написать условие в описании группы - *[ bot: ${num} ]*`
	},
	error: (e) => { return `Произошла ошибка при выполнение команды, ошибка: ${e}\n\n P.s Попробуйте выполнить команду повторно, в противном случае напищите в поддержку - .support`; },
	//============================================================= - Проверка доступа к командам -
	isBot: () => { return `❗ *Ошибка*\n\n> У вас уже есть бот на аккаунте, вы не можете подключить еще одного...`; },
	isGroup: () => { return `❗ *Ошибка*\n\n> Эта команда доступна только в группе...`; },
	isAdmins: () => { return `❗ *Ошибка*\n\n> Эта команда доступна только Администраторам группы....` },
	isBotAdmins: () => { return `❗ *Ошибка*\n\n> Мне нужны права Администратора для выполнения данной команды` },
	isPrivate: () => { return `❗ *Ошибка*\n\n> Эта команда доступна только в ЛС у бота...` },
	notMsg: ({ senderMSG, msg }) => { return `❗ *Ошибка*\n\n> _Вы не можете использовакть данную команду,т.к у вас ${senderMSG} msg(Нужно ${msg} msg)._\n> P.s для накопления сообщений вам нужно зайти в любую группу где есть бот(.support группа создателя) и начать общаться.\n\n> Если вы не хотите копить, вы можете купить собщения(Подробнее .donate)`; },
	notLvl: ({ lvl, msg }) => {
		if (msg) {
			return `❗ *Ошибка*\n\n> Откроется на ${lvl} уровне.\n> Стоимость команды будет - *${msg}* MSG`;
		} else {
			return `❗ *Ошибка*\n\n> Откроется на ${lvl} уровне.`;
		}
	},
	notCreator: () => { return `❗ *Ошибка*\n\n> _У вас нету доступа к этой команде..._`; },
	notUser: () => { return `❗ *Ошибка*\n\n> Отметь участника используя @, или же сообщение...`; },
	notBotNumber: () => { return `❗ *Ошибка*\n\n> Данная команда доступна только пользователям с ботом на аккаунте...`; },
	notGroup: () => { return `❗ *Ошибка*\n\n> Эта команда доступна только в группе`; },
	setBan: ({ status, user }) => {
		if (status === 'true') {
			return `Аккаунт ${user} - был успешно заблокирован...`;
		} else if (status === 'alreadyTRUE') {
			return `Аккаунт ${user} - уже был зблокирован...`;
		} else if (status === 'alreadyFALSE') {
			return `Аккаунт ${user} - уже был разблокирован...`;
		} else {
			return `Аккаунт ${user} - был успешно разблокирован...`;
		}
	},
	//================================================================ - Конвертер/Загрузчик и обработка текста -
	notPQuoted: () => { return `🛡️ *Помощь*\n\n> _Отметь стикер.._`; },
	notSQuoted: () => { return `🛡️ *Помощь*\n\n> *Отметь стикер..(Стоимость команды, 150msg за изображение и 550 msg за видео)*`; },
	notVVQuoted: () => { return "🛡️ *Помощь*\n\n> ```Отметь сообщение в однократном просмотре и я его скачаю```"; },
	notText: ({ text }) => {
		if (text === 'sticker') {
			return `🛡️ *Помощь*\n\n> Используй *.s/.steal text | text*`;
		} else if (text === 'tts') {
			return `'🛡️ *Помощь*\n\n> Используй .tts *текст*'`;
		} else if (text === 'orientation') {
			return `🛡️ *Помощь*\n\n> Используйте *.setorientation TeXt* (не больше 17 символов, без ссылок)`;
		} else if (text === 'donateMSG') {
			return `'🛡️ *Помощь*\n\n> Используй *.donate msg сумма*'`
		} else if (text === 'donateSUPP') {
			return `🛡️ *Помощь*\n\n> Используй *.donate supp сумма*`
		} else if (text === '!<=0') {
			return `🛡️ *Помощь*\n\n> Сумма должна быть > 0 ((`
		} else if (text === 'ttt') {
			return `🛡️ *Помощь*\n\n> Используй *.ttt ставка*`
		} else if (text === 'warn') {
			return `🛡️ *Помощь*\n\n> Используй *.warn @ причина*`
		} else if (text === 'setwelcome') {
			return `🛡️ *Помощь*\n\n> Используй *.setwelcome _@user ку-ку, welcome to @gname_*\n> @user - отметить того кто вступил\n> @gname - отметить название группы`
		} else if (text === 'setgoodbye') {
			return `🛡️ *Помощь*\n\n> Используй *.setgoodbye _@user НН Ливнул_*\n> @user - отметить того кто покинул\n> @gname - отметить название группы`
		} else if (text === 'custom') {
			return `🛡️ *Помощь*\n\n> Что ты хочешь с ним сделать?(Используй *.custom _действие_*)`
		} else if (text === 'image') {
			return `🛡️ *Помощь*\n\n> Что мне искать?(Используй *.image _название фотографии_*)`
		} else if (text === 'weather') {
			return `🛡️ *Помощь*\n\n>  Что мне искать(Используй *.wetaher _город_*)`
		} else if (text === 'gpt') {
			return `🛡️ *Помощь*\n\n>  Что ты от меня хочешь?(Используй *.chat _вопрос_*)`
		} else if (text === 'setting') {
			return `🛡️ *Помощь*\n\n> 1) *.setting act/deact events* (вкл/выкл приветствие/прощание в группе)\n\n> 2) *.setting act/deact antilink* (вкл/выкл защита от рекламы в группе)\n\n> 3) *.setting act/deact nsfw* (вкл/выкл поддержку 18+ команд)\n\n> 4) *.setting act/deact visible valute* (вкл/выкл показ валюты)\n\n> 5) *.setting act/deact bot chat* (вкл/выкл бота в чате)\n\n> 6) *.setting act/deact adminswitch* (вкл/выкл отслеживания тех кто снял с админки)\n\n> 7) *.setting delete account* (Удаление всех ваших данных из бд бота, будьте осторожны с данной командой !!)`
		} else {
			return "Неизвестная команда";
		}
	},

	textShip: ({ status, percent, sender, shiper, couple }) => {
		let text
		if (status === 'percent') {
			if (percent < 25) {
				text = `\t\t\t\t\t*ShipПроцент : ${percent}%* \n\t\tДумаю тебе стоит пересмотреть свой выбор`
			} else if (percent < 50) {
				text = `\t\t\t\t\t*ShipПроцент : ${percent}%* \n\t\tУ вас ничего не получиться,расходитесь 💫`
			} else if (percent < 75) {
				text = `\t\t\t\t\t*ShipПроцент : ${percent}%* \n\t\t\tОставайтесь вместе и у вас всё получиться ⭐️`
			} else if (percent < 90) {
				text = `\t\t\t\t\t*ShipПроцент : ${percent}%* \n\tОтлично,вы вдвоём будете очень хорошей парой 💖 `
			} else {
				text = `\t\t\t\t\t*ShipПроцент : ${percent}%* \n\tВам суждено быть вместе💙`
			}
			return text;
		} else if (status === 'sender') {
			return '```' + 'Подожди... Что?!!,Ты хочешь джахатся сам с собой?' + '```'

		} else if (status === 'check') {

			let caption = `\t❣️ *Смотрим...* ❣️ \n`
			caption += `\t\t✯────────────────────✯\n`
			caption += `${sender}  x  ${shiper}\n`
			caption += `\t\t✯────────────────────✯\n`
			caption += couple
			return caption
		}
	},

	notTTPEnglisch: () => { return `❗ *Ошибка*\n\n> ТТП стикеры поддерживают только английский`; },
	notATTPEnglisch: () => { return `❗ *Ошибка*\n\n> АТТП стикеры поддерживают только английский`; },
	notVideo: () => { return `> ❌ Не удалось найти видео по вашему запросу.` },
	//================================================================================= - Экономика -
	questMSG: ({ msg, react, time, noReact = false }) => {
		if (noReact) {
			return `❌ Выполнение команды отменено.\n\nРеакция не получена в течение ${time} мс.`;
		} else {
			const reactionText = react ? `P.s Для подтверждения поставьте реакцию -> ${react} на это сообщение` : 'Для подтверждения поставьте любую реакцию на это сообщение';
			return `_*Вы уверены, что хотите потратить ${msg} msg на выполнение команды?*_\n\n${reactionText} в течение ${time} мс.`;
		}
	},
	questMSGSlot: ({ time, noReact = false, amount }) => {
		if (noReact) {

			return `Ты не нашел нужную реакцию за ${time} мс.\n\n Ты проиграл свои мсг :(`;
		}
	},
	setMsg: ({ msg, jid }) => { return `Вы установили значение msg ${msg}, ему @${jid.split('@')[0]}`; },
	giveMsg: ({ msg, jid }) => { return `Вы выдали ${msg} msg, ему @${jid.split('@')[0]}`; },
	takeMsg: ({ msg, jid }) => { return `Вы забрали ${msg} msg, у @${jid.split('@')[0]}`; },
	giveMyMsg: ({ msg, jid }) => { return `Вы передали ${msg} msg, ему @${jid.split('@')[0]}`; },
	setLvl: ({ lvl, jid }) => { return `Вы установили значение lvl ${lvl}, ему @${jid.split('@')[0]}` },
	giveLvl: ({ lvl, jid }) => { return `Вы выдали ${lvl} lvl, ему @${jid.split('@')[0]}` },
	takeLvl: ({ ll, jid }) => { return `Вы забрали ${lvl} lvl, у @${jid.split('@')[0]}` },
	notMyMsg: ({ msg, senderMsg }) => { return `Вы не можете перевести ${msg} msg, т.к у вас всего-лишь - ${senderMsg}`; },
	notCorrectSum: () => { return `Сумма должна быть >= 0`; },
	levelUp: ({ oldLvl, newLvl, newMsg }) => { return `🌎 *Информация*\n\n> Ваш уровень повышен с ${oldLvl} до ${newLvl}\n> Остаток баланса: ${newMsg} msg`; },
	checkUserInfo: ({ users, msg, dailyMsg }) => { return `У ${users} -  *${msg}* msg\n Сообщений за день - ${dailyMsg} msg`; },
	//-----------Ранг
	free: () => 'freeUser ⚠️',
	vip: () => 'VIP 💎',
	visibleText: (status) => {
		if (status) {
			return ': '
		} else {
			return '- ( *  *  * ) -';
		}
	},

	greeting: (pushName) => `*Привет, 🌟 ${pushName}*\n\n`,
	msgFamily: (mesgg) => { return `> *[📥] - MSG семьи*${mesgg}`; },
	msgTotal: (mesgg) => { return `> *[📥] - Всего MSG*${mesgg}`; },
	cazna: (mesgg) => { return `> *[🏦] - Казна*: ${mesgg}` },
	userStats: `     🌸 Это твой аккаунт:\n`,
	role: (role) => { return `> *[🌟] - Роль:* ${role}`; },
	groupRole: (groupRole) => { return `> *[🐣] - Роль в группе:* ${groupRole}` },
	level: (userLevel) => { return `> *[🏡] - Уровень:* ${userLevel}`; },
	nextLevel: async (citel, checkNextLevel) => { return `> *• До следующего:* ${await checkNextLevel(citel.sender)}` },
	dailyMsg: (dailyMsg) => { return `> *[📥] - Соо за день в чате:* ${dailyMsg}`; },
	allMsg: (allMsg) => { return `> *[📥] - Cообщений в чате:* ${allMsg}` },
	orientation: (userOrientation) => { return `> *[👾] - Ориентация:* ${userOrientation}`; },
	userCheck: (userCheck) => {

	},

	notOrientation: () => { return "Вы не установили свою ориентацию, используй *.setorientation _TeXt_*"; },
	setOrientation: (orientation) => { return `Вы изменили свою ориентацию на "${orientation}"`; },
	visibleValute: (check) => {
		if (check === 'act') {
			return '*Ваша валюта была открыта для показа всем//*'
		} else if (check === 'alreadyAct') {
			return `Валюта уже была раскрыта//`
		} else if (check === 'alreadyDeact') {
			return 'Валюта уже была скрыта//'
		} else {
			return '*Ваша валюта была скрыта и доступна для просмотра только у вас в лс//*'
		}
	},
	//------------------------------------------Казино 
	slotResults: (i, j, k, deduff, hasJackpot) => {
		let st = `🎰 Результаты\n     ${i}\n\n     ${j}\n\n     ${k}\n\n${hasJackpot ? 'Джекпот🎊' : 'Нет Джекпота📉'}.`;
		let str = st.replace(/1/g, `🔴`).replace(/2/g, `🔵`).replace(/3/g, `🟣`).replace(/4/g, `🟢`).replace(/5/g, `🟡`).replace(/6/g, `⚪️`).replace(/7/g, `⚫️`).replace(/:/g, `  `);
		return `${str} ${hasJackpot ? `Ты выиграл ${deduff} сообщений в кошелек.` : `${deduff} сообщений.`}`;
	},
	notAvailableInGroup: () => "Данная команда не доступна в данной группе, так как для этого есть отдельная группа.",
	cooldownMessage: (remainingMinutes) => `Вы уже использовали эту команду. Попробуйте снова через ${remainingMinutes} минут.`,
	invalidBet: () => `*Введи коректную ставку! Пример:\n\n> .slot1 2599* `,
	slot1Results: (i, j, k, deduff, hasJackpot, amount) => {
		let st = `🎰 Результаты\n     ${i}\n\n     ${j}\n\n     ${k}\n\n${hasJackpot ? 'Джекпот🎊' : 'Нет Джекпота📉'}.`;
		let str = st.replace(/1/g, `🔴`).replace(/2/g, `🔵`).replace(/3/g, `🟣`).replace(/4/g, `🟢`).replace(/5/g, `🟡`).replace(/6/g, `⚪️`).replace(/7/g, `⚫️`).replace(/:/g, `  `);
		return `${str} ${hasJackpot ? `Ты выиграл ${deduff * amount} сообщений в кошелек. (${deduff} × ${amount} = ${deduff * amount})` : `${-deduff} сообщений, умноженые на ${amount}. (${-deduff} × ${amount} = ${-deduff * amount})`}`;
	},
	//-----------Браки
	notEnoughLevel: () => "❗ *Ошибка*\n\n> Вы не можете создать брак, так как у вас или у вашей будущей жены нет 16-ого уровня:(",
	cannotMarryYourself: () => "❗ *Ошибка*\n\n> Ты не можешь сам себе подать заявку на регистрацию брака",
	alreadyMarried: () => "❗ *Ошибка*\n\n> Вы к сожалению уже в браке.",
	alreadySentRequest: () => "❗ *Ошибка*\n\n> Вы уже отправляли запрос, ожидайте ответа... (Отменить запрос - .cancelmarry)",
	userAlreadyMarried: (userName) => `❗ *Ошибка*\n\n> *@${userName.split('@')[0]} уже состоит в браке.*`,
	userAlreadySentRequest: () => "❗ *Ошибка*\n\n> *Данный человек отправил кому-то запрос, поэтому с ним нельзя зарегистрировать брак*",
	askForMarriage: (senderName, targetName) => `*Здравствуйте, @${targetName.split('@')[0]}! Согласны ли вы зарегистрировать брак с @${senderName.split('@')[0]}? (Принять - .acceptmarry)*`,
	alreadySentProposal: () => "❗ *Ошибка*\n\n> *Вы не можете подтвердить брак, так как у вас есть созданное предложение*",
	alreadyMarried2: () => "❗ *Ошибка*\n\n> *Вы уже зарегистрировали брак*",
	notReceivedProposal: () => "❗ *Ошибка*\n\n> *Вам никто не предлагал вступить в брак*",
	successfulMarriage: () => "Вы успешно зарегистрировали брак *(.rank)*",
	proposalRejected: () => "Вы успешно отказали на запрос о регистрации брака *(.rank)*",
	notInMarriage: () => "❗ *Ошибка*\n\n> *Вы не в браке*",
	cancelRequest: () => "*Вы успешно отменили заявку*",
	cannotDivorce: () => "*Введите .cancelmarry для отмены заявки на брак, или .rejectmarry для отказа на заявку на брак.*",
	successfulDivorce: () => "*Вы успешно развелись* (.profile)",
	//--------------Реакции
	nsfwDisabled: () => "18+ Команды отключены в данной группе",
	bite: () => "кусает",
	biteSelf: () => "кусает себя",
	pat: () => "гладит",
	patSelf: () => "гладит себя",
	kiss: () => "целует",
	kissSelf: () => "целует себя",
	kill: () => "убил",
	killSelf: () => "убил(а) сам(а) себя",
	happy: () => "радуется за",
	happySelf: () => "радуется за самого(у) себя",
	dance: () => "танцует с",
	danceSelf: () => "танцует сам(а) с собой",
	hug: () => "обнимает",
	hugSelf: () => "обнимает сам(у) себя",
	minet: () => "сделал(а) минет",
	minetSelf: () => "сделал(а) минет сам(а) себе",
	viebat: () => "выебал(а)",
	viebatSelf: () => "выебал(а) сам(у) себя",

	getRoleByLevel: async (sender) => {
		const { sck1 } = require('./lib')
		const user = await sck1.findOne({ id: sender })
		let role = "👑 Бог";

		if (user.level <= 2) {
			role = "🏳 Новичок";
		} else if (user.level <= 4) {
			role = "👼 Ребёнок";
		} else if (user.level <= 8) {
			role = "🧙‍♀️ Волшебник";
		} else if (user.level <= 12) {
			role = "🧙‍♂️ Похититель";
		} else if (user.level <= 16) {
			role = "🔮 Маг";
		} else if (user.level <= 18) {
			role = "🔮 Великий Маг";
		} else if (user.level <= 22) {
			role = "✍️ Писатель";
		} else if (user.level <= 26) {
			role = "💬 Комментатор";
		} else if (user.level <= 30) {
			role = "💭 Мыслитель";
		} else if (user.level <= 34) {
			role = "⚡Молноиносный";
		} else if (user.level <= 36) {
			role = "🎭 Актёр";
		} else if (user.level <= 40) {
			role = "🥇Победитель I";
		} else if (user.level <= 44) {
			role = "🥈Призёр II";
		} else if (user.level <= 48) {
			role = "🏅OLD";
		} else if (user.level <= 50) {
			role = "🎖Лучший";
		} else if (user.level <= 56) {
			role = "🏅Спамер";
		} else if (user.level <= 58) {
			role = "🏆Главарь";
		} else if (user.level <= 59) {
			role = "💍Верховный  I";
		} else if (user.level <= 60) {
			role = "💎Верховный II";
		} else if (user.level <= 62) {
			role = "🔮Верховный мастер";
		} else if (user.level <= 66) {
			role = "🛡Легендарный I";
		} else if (user.level <= 70) {
			role = "🏹 Легендарный II";
		} else if (user.level <= 72) {
			role = "🙉 Прислуга";
		} else if (user.level <= 100) {
			role = "✨️ ПисяПопа";
		}

		return role;
	},

	getMarriageInfoText: async (sender) => {
		try {
			const { marrynaxoi } = require('./lib')
			let marriageInfo = await marrynaxoi.findOne({ id: sender });
			if (!marriageInfo) marriageInfo = await new marrynaxoi({ id: sender }).save();
			const { status } = marriageInfo;
			if (status === "alone") {
				return '> *[👨‍👩‍👧] - В браке: Нет*';
			} else if (status === "init") {
				return '> *[👨‍👩‍👧] - В браке: Ждем подтверждения*';
			} else if (status === "registered") {
				return `> *[👨‍👩‍👧] - В браке: Да*\n> С кем - @${marriageInfo.who.split('@')[0]}\n`;
			}
		} catch (error) {
			console.error('Error in getMarriageInfoText:', error);
			return 'Произошла ошибка при получении информации о браке.';
		}
	}
}

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	delete require.cache[file]
	require(file)
})

module.exports = {};
