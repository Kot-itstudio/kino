import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import chalk from 'chalk';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';
import readline from 'readline';

import config from './config.js';
import Database from './lib/database.js';
import { safeSend, safeReact, safePresence } from './lib/safeSend.js';
import { font, sendReply, sendMessage, buildAdReplyContext } from './lib/helpers.js';
import sudoManager from './lib/sudoManager.js';
import botTracker from './lib/botTracker.js';
import { isAdmin, isOwner, checkPermissions } from './lib/groups.js';
import { handleMentionTrigger } from './commands/settag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const groupCache = new NodeCache({ stdTTL: 10 * 60, checkperiod: 120, useClones: false });

let sock = null;
let isConnected = false;
let welcomeMessageSent = false;
let welcomeMessageSentSession = false;
let connectionAttempts = 0;
const commands = new Map();
const userWarnings = new Map();
const lastMessageTime = new Map();

function ask(questionText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(questionText, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

async function loadCommands() {
  console.log('📚 Loading commands...');
  commands.clear();

  const commandsDir = path.join(process.cwd(), 'commands');
  if (!fs.existsSync(commandsDir)) {
    console.log('📁 Creating commands directory');
    fs.mkdirSync(commandsDir, { recursive: true });
    return;
  }

  const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

  for (const file of files) {
    try {
      const commandPath = path.join(commandsDir, file);
      const commandUrl = `file://${commandPath}?update=${Date.now()}`;
      const command = await import(commandUrl);
      const cmd = command.default || command;

      if (cmd.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (cmd.aliases && Array.isArray(cmd.aliases)) {
          cmd.aliases.forEach(alias => {
            commands.set(alias.toLowerCase(), cmd);
          });
        }
        console.log(`✅ Loaded: ${cmd.name}`);
      }
    } catch (error) {
      console.error(`❌ Error loading ${file}:`, error.message);
    }
  }

  console.log(`📦 ${commands.size} commands loaded`);
}

function getPhoneFromJID(jid) {
  return jid?.match(/^(\d+)@/)?.[1] || jid;
}

function getUserWarnings(jid, userId) {
  const key = `${jid}_${userId}`;
  if (!userWarnings.has(key)) {
    userWarnings.set(key, {
      antilink: 0,
      antispam: 0,
      messages: [],
      lastReset: Date.now()
    });
  }
  return userWarnings.get(key);
}

function resetUserWarnings(jid, userId = null) {
  if (userId) {
    userWarnings.delete(`${jid}_${userId}`);
  } else {
    const keysToDelete = [];
    for (const [key] of userWarnings) {
      if (key.startsWith(`${jid}_`)) keysToDelete.push(key);
    }
    keysToDelete.forEach(key => userWarnings.delete(key));
  }
}

async function checkSpam(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;
    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const warnings = getUserWarnings(jid, sender);
    const now = Date.now();

    warnings.messages = warnings.messages.filter(m => now - m.timestamp < 5000);
    warnings.messages.push({ timestamp: now, body });

    if (warnings.messages.length > 5) {
      await safeSend(sock, jid, { delete: msg.key });
      warnings.antispam++;

      await safeSend(sock, jid, {
        text: `⚠️ @${sender.split('@')[0]} - SPAM DETECTED!\nWarnings: ${warnings.antispam}/${groupSettings.antispam_threshold || 3}`,
        mentions: [sender]
      });

      if (warnings.antispam >= (groupSettings.antispam_threshold || 3)) {
        try {
          await sock.groupParticipantsUpdate(jid, [sender], 'remove');
          await safeSend(sock, jid, {
            text: `🚫 @${sender.split('@')[0]} removed for spamming`,
            mentions: [sender]
          });
        } catch (e) {}
      }
    }
  } catch (error) {
    console.error('Spam error:', error.message);
  }
}

async function checkLinks(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;
    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
    if (linkRegex.test(body)) {
      await safeSend(sock, jid, { delete: msg.key });
      const warnings = getUserWarnings(jid, sender);
      warnings.antilink++;

      await safeSend(sock, jid, {
        text: `🔗 @${sender.split('@')[0]} - LINKS NOT ALLOWED!\nWarnings: ${warnings.antilink}/${groupSettings.antilink_threshold || 3}`,
        mentions: [sender]
      });

      if (warnings.antilink >= (groupSettings.antilink_threshold || 3)) {
        try {
          await sock.groupParticipantsUpdate(jid, [sender], 'remove');
          await safeSend(sock, jid, {
            text: `🚫 @${sender.split('@')[0]} removed for sending links`,
            mentions: [sender]
          });
        } catch (e) {}
      }
    }
  } catch (error) {
    console.error('Link error:', error.message);
  }
}

async function checkMentions(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;
    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const hasMassMention = mentions.length >= 3;
    const hasGroupMention = body.includes('@everyone') || body.includes('@all');

    if (hasMassMention || hasGroupMention) {
      await safeSend(sock, jid, { delete: msg.key });
      await safeSend(sock, jid, {
        text: `⚠️ @${sender.split('@')[0]} - MASS MENTIONS NOT ALLOWED!`,
        mentions: [sender]
      });
    }
  } catch (error) {
    console.error('Mention error:', error.message);
  }
}

async function checkMassTags(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;
    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length >= 5) {
      await safeSend(sock, jid, { delete: msg.key });
      await safeSend(sock, jid, {
        text: `⚠️ @${sender.split('@')[0]} - TOO MANY TAGS!`,
        mentions: [sender]
      });
    }
  } catch (error) {
    console.error('Tag error:', error.message);
  }
}

async function handleGroupParticipantsUpdate(event) {
  const { id, participants, action } = event;

  try {
    const groupSettings = await Database.getGroupSettings(id);

    if (action === 'demote' && groupSettings.antidemote_enabled) {
      console.log(`🛡️ Anti-Demote for ${id}`);
      await new Promise(r => setTimeout(r, 1000));
      for (const p of participants) {
        try {
          await sock.groupParticipantsUpdate(id, [p], 'promote');
        } catch (e) {}
      }
    }

    if (action === 'promote' && groupSettings.antipromote_enabled) {
      console.log(`🛡️ Anti-Promote for ${id}`);
      await new Promise(r => setTimeout(r, 1000));
      for (const p of participants) {
        try {
          await sock.groupParticipantsUpdate(id, [p], 'demote');
        } catch (e) {}
      }
    }

    if (action === 'add' && groupSettings.welcome_enabled) {
      const metadata = await sock.groupMetadata(id);
      for (const p of participants) {
        const text = groupSettings.welcome_message || `🎉 Welcome @${p.split('@')[0]} to ${metadata.subject}!`;
        await sock.sendMessage(id, { text, mentions: [p] });
      }
    }

    if (action === 'remove' && groupSettings.goodbye_enabled) {
      const metadata = await sock.groupMetadata(id);
      for (const p of participants) {
        const text = groupSettings.goodbye_message || `👋 @${p.split('@')[0]} left ${metadata.subject}`;
        await sock.sendMessage(id, { text, mentions: [p] });
      }
    }
  } catch (error) {
    console.error('Group update error:', error.message);
  }
}

async function sendWelcomeMessage() {
  if (welcomeMessageSent || welcomeMessageSentSession) return;
  if (!sock || !isConnected) return;

  try {
    const userSettings = await Database.getUserSettings();
    const welcomeMessage = `❤️ LOVE-XD-BOT CONNECTED ❤️\n\nBot Name: ${userSettings.bot_name}\nCreator: ${userSettings.creator || config.owner}\nPrefix: ${userSettings.prefix}\nMode: ${userSettings.bot_mode}\n\n⚡ Powered By DarkMods`;

    if (config.owner) {
      const ownerJid = `${config.owner}@s.whatsapp.net`;
      await sock.sendMessage(ownerJid, {
        image: { url: userSettings.menu_image },
        caption: welcomeMessage
      });
      console.log('✅ Welcome message sent');
    }

    welcomeMessageSent = true;
    welcomeMessageSentSession = true;
  } catch (error) {
    console.error('Welcome error:', error.message);
  }
}

async function handleStatusMessage(message) {
  try {
    const { handleAutoStatus } = await import('./commands/autostatus.js');
    await handleAutoStatus(sock, { messages: [message] });
  } catch (error) {}
}

async function handleAutoFeatures(msg) {
  try {
    const { handleAutowriteMessage } = await import('./commands/autowrite.js');
    if (handleAutowriteMessage) await handleAutowriteMessage(sock, msg);
  } catch (e) {}

  try {
    const { handleAutoReact } = await import('./commands/autoreact.js');
    if (handleAutoReact) await handleAutoReact(sock, msg);
  } catch (e) {}
}

async function handleMessage(msg) {
  if (!msg.message) return;

  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || jid;
  const isGroup = jid?.endsWith('@g.us');

  const body = msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption || '';

  const userSettings = await Database.getUserSettings();
  const isCommand = body.startsWith(userSettings.prefix);

  if (msg.key.fromMe && !isCommand) return;

  if (msg.message?.protocolMessage?.type === 0) {
    try {
      const { handleMessageRevocation } = await import('./commands/antidelete.js');
      await handleMessageRevocation(msg, sock);
    } catch (e) {}
    return;
  }

  try {
    const { storeMessage } = await import('./commands/antidelete.js');
    await storeMessage(msg, sock);
  } catch (e) {}

  if (!isCommand && !msg.key.fromMe) {
    await handleAutoFeatures(msg);
  }

  if (isCommand) {
    await handleCommand(msg, body, userSettings);
  }

  if (isGroup && !msg.key.fromMe) {
    await handleMentionTrigger(sock, msg);

    const groupSettings = await Database.getGroupSettings(jid);
    if (groupSettings.antispam_enabled) await checkSpam(msg, jid, sender, body, groupSettings);
    if (groupSettings.antilink_enabled) await checkLinks(msg, jid, sender, body, groupSettings);
    if (groupSettings.antimention_enabled) await checkMentions(msg, jid, sender, body, groupSettings);
    if (groupSettings.antitag_enabled) await checkMassTags(msg, jid, sender, body, groupSettings);
  }
}

async function handleCommand(msg, body, userSettings) {
  const jid = msg.key.remoteJid;
  const args = body.slice(userSettings.prefix.length).trim().split(/\s+/);
  const commandName = args[0]?.toLowerCase();

  if (!commandName) return;

  try {
    const command = commands.get(commandName);
    if (!command) return;

    const permission = await checkPermissions({
      sock, msg, userSettings, commandName
    });

    if (!permission.allowed) {
      let errorMsg = '❌ Permission denied';
      if (permission.reason === 'OWNER_ONLY') errorMsg = '👑 Owner only command';
      if (permission.reason === 'PREMIUM_ONLY') errorMsg = '💎 Premium feature';
      if (permission.reason === 'ADMIN_ONLY') errorMsg = '🛡️ Admin only command';
      if (permission.reason === 'ACCESS_DENIED') return;

      await safeSend(sock, jid, { text: errorMsg });
      return;
    }

    const groupSettings = jid.endsWith('@g.us') ? await Database.getGroupSettings(jid) : {};

    await command.execute({
      sock,
      msg,
      args: args.slice(1),
      phoneNumber: config.owner,
      userSettings,
      groupSettings,
      jid,
      isGroup: jid.endsWith('@g.us'),
      getUserWarnings: (userId) => getUserWarnings(jid, userId),
      resetUserWarnings: (userId) => resetUserWarnings(jid, userId)
    });

    botTracker.incrementCommands(commandName);
  } catch (error) {
    console.error('Command error:', error.message);
    await safeSend(sock, jid, { text: `❌ Error: ${error.message}` });
  }
}

async function startBot(usePairing = true) {
  try {
    console.log('🔄 Starting WhatsApp connection...');

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
      },
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true
    });

    sock.ev.on('creds.update', saveCreds);

    if (usePairing && !state.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(config.owner);
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log(`\n🔐 Pairing Code: ${formattedCode}\n`);
          qrcodeTerminal.generate(formattedCode, { small: true });
        } catch (error) {
          console.error('Pairing error:', error.message);
        }
      }, 3000);
    }

    async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_master')
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: 'fatal' }),
        browser: ['WaffenBOT', 'Chrome', '120.0.0.0'],
    })

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update

        if (qr) {
            logger.info('QR-код сгенерирован (сохранён в qr.html и qr.png)')
            // Чтобы быстро показать QR в браузере — делаем png меньше и HTML компактнее
            const outDir = __dirname

            // PNG для браузера/перезапуска, HTML — чтобы показывался в браузере без консоли
            await QRCode.toFile('qr.png', qr, { width: 200 }).catch(e => {
                logger.error('Ошибка сохранения QR:', e.message)
            })

            const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>WaffenBOT QR</title>
<style>
  body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b0b;color:#fff;font-family:Arial}
  .wrap{text-align:center}
  img{width:320px;max-width:90vw;height:auto;image-rendering:pixelated}
  .hint{margin-top:14px;opacity:.85;font-size:14px;max-width:520px;line-height:1.3}
</style>
</head>
<body>
  <div class="wrap">
    <div>Отсканируйте QR в WhatsApp</div>
    <img src="qr.png" alt="QR" />
    <div class="hint">Если старый QR не обновился, перезагрузите страницу.</div>
  </div>
</body>
</html>`

            await fs.promises.writeFile(path.join(__dirname, 'qr.html'), html, 'utf8').catch(e => {
                logger.error('Ошибка сохранения qr.html:', e.message)
            })

            qrcodeTerminal.generate(qr, { small: true })
            logger.info('Откройте qr.html в браузере: e:/Roman/Projects/WaffenBOT/qr.html')
        }

        if (connection === 'open') {
            logger.info('[WaffenBOT] Авторизация успешна')
        }


      if (connection === 'open') {
        console.log('✅ WhatsApp connected');
        isConnected = true;

        if (!welcomeMessageSent && !welcomeMessageSentSession) {
          botTracker.start();
          setTimeout(() => sendWelcomeMessage(), 2000);
        }
      } else if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('❌ Session logged out');
          welcomeMessageSent = false;
          welcomeMessageSentSession = false;
          connectionAttempts = 0;
          return;
        }

        connectionAttempts++;
        setTimeout(() => startBot(usePairing), 3000);
      }
    });

    await loadCommands();

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key.remoteJid === 'status@broadcast') {
          await handleStatusMessage(message);
        } else {
          await handleMessage(message);
        }
      }
    });

    sock.ev.on('group-participants.update', async (event) => {
      await handleGroupParticipantsUpdate(event);
    });

  } catch (error) {
    console.error('Startup error:', error);
    setTimeout(() => startBot(usePairing), 5000);
  }
}

async function listenForDashboardCommands() {
  setInterval(async () => {
    try {
      const response = await fetch('https://steph-api.vercel.app/api/check-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: config.owner })
      });
      if (response.ok) {
        const data = await response.json();
        const commands = data.commands || data;
        for (const cmd of commands || []) {
          if (cmd.type === 'BROADCAST' && sock) {
            await sock.sendMessage(`${config.owner}@s.whatsapp.net`, { text: cmd.message });
          }
        }
      }
    } catch (e) {}
  }, 5 * 60 * 1000);
}

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 Bot running');
}).listen(config.port, () => {
  console.log(chalk.blue(`🌐 Server on port ${config.port}`));
});

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Stopping bot...'));
  botTracker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 Stopping bot...'));
  botTracker.stop();
  process.exit(0);
});

startBot(true);
listenForDashboardCommands()
