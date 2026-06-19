import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   CONSTANTS DE STYLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BRAND = `\n\n╰┈➤ 𝘿𝙖𝙧𝙠𝙈𝙤𝙙𝙨 ✦`;
const SEP = '─'.repeat(28);

const banner = (icon, title) => `${icon} *${title}*\n${SEP}`;

async function react(sock, msg, emoji) {
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   MODULE PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default {
    name: 'convert',
    aliases: ['toimg', 'tovid', 'sticker2img', 'sticker2vid'],
    description: 'Convertit les stickers en image ou vidéo',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Vérifier qu'un sticker est cité
        if (!quoted?.stickerMessage) {
            await react(sock, msg, '⚠️');
            await sock.sendMessage(jid, {
                text:
                    `${banner('🔄', 'CONVERTIR UN STICKER')}\n\n` +
                    `⚠️ *Aucun sticker détecté*\n\n` +
                    `Pour utiliser cette commande :\n` +
                    `  1️⃣ Envoyez ou trouvez un sticker\n` +
                    `  2️⃣ Répondez-lui avec :\n\n` +
                    `     \`!toimg\`  — convertir en 🖼️ image\n` +
                    `     \`!tovid\`  — convertir en 🎬 vidéo` + BRAND
            }, { quoted: msg });
            return;
        }

        const body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text || '';
        const commandName = body
            .slice(userSettings.prefix.length)
            .trim()
            .split(/\s+/)[0]
            .toLowerCase();

        try {
            await react(sock, msg, '⏳');

            // Télécharger le sticker
            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Téléchargement du sticker impossible');
            }

            if (commandName === 'toimg' || commandName === 'sticker2img') {
                await convertToImage(sock, msg, buffer, phoneNumber);
            } else if (commandName === 'tovid' || commandName === 'sticker2vid') {
                await convertToVideo(sock, msg, buffer, phoneNumber);
            } else {
                await react(sock, msg, '❓');
                await sock.sendMessage(jid, {
                    text: `❓ Commande inconnue. Utilisez \`!toimg\` ou \`!tovid\`.` + BRAND
                }, { quoted: msg });
            }

        } catch (error) {
            console.error(`❌ Erreur conversion [${phoneNumber}]:`, error.message);
            await react(sock, msg, '❌');
            await sock.sendMessage(jid, {
                text:
                    `❌ *Échec de la conversion*\n${SEP}\n` +
                    `\`${error.message}\`\n\n` +
                    `Vérifiez que le sticker est valide et réessayez.` + BRAND
            }, { quoted: msg });
        }
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   CONVERSION EN IMAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function convertToImage(sock, msg, buffer, phoneNumber) {
    const jid = msg.key.remoteJid;

    const isAnimated = await checkIfAnimatedWebP(buffer);

    let imageBuffer;

    if (isAnimated) {
        // Extraire le premier frame du WebP animé
        const frame = await extractFirstFrameFromWebP(buffer);
        imageBuffer = frame ?? buffer; // Fallback: envoyer le WebP brut
    } else {
        imageBuffer = buffer;
    }

    await sock.sendMessage(jid, {
        image: imageBuffer,
        caption:
            `${banner('🖼️', 'STICKER → IMAGE')}\n\n` +
            `✅ Conversion réussie${isAnimated ? ' *(1er frame extrait)*' : ''}` + BRAND
    }, { quoted: msg });

    await react(sock, msg, '✅');
    console.log(`✅ [${phoneNumber}] Sticker → Image`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   CONVERSION EN VIDÉO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function convertToVideo(sock, msg, buffer, phoneNumber) {
    const jid = msg.key.remoteJid;

    const isAnimated = await checkIfAnimatedWebP(buffer);
    let videoBuffer;

    if (isAnimated) {
        console.log(`🎬 [${phoneNumber}] Conversion sticker animé → WebM`);
        videoBuffer = await convertToWebM(buffer);
    } else {
        console.log(`📹 [${phoneNumber}] Conversion sticker statique → MP4`);
        videoBuffer = await createSimpleVideo(buffer);
    }

    if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error('La vidéo générée est vide');
    }

    await sock.sendMessage(jid, {
        video: videoBuffer,
        caption:
            `${banner('🎬', 'STICKER → VIDÉO')}\n\n` +
            `✅ Conversion réussie${isAnimated ? ' *(WebM animé)*' : ' *(MP4 statique)*'}` + BRAND
    }, { quoted: msg });

    await react(sock, msg, '✅');
    console.log(`✅ [${phoneNumber}] Sticker → Vidéo`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   UTILITAIRES INTERNES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Détecte si un buffer WebP est animé */
async function checkIfAnimatedWebP(buffer) {
    try {
        if (buffer.length < 20) return false;
        if (buffer.toString('ascii', 0, 4) !== 'RIFF') return false;
        if (buffer.toString('ascii', 8, 12) !== 'WEBP') return false;

        const hex = buffer.toString('hex');
        // ANIM = 414e494d, ANMF = 414e4d46
        return hex.includes('414e494d') || hex.includes('414e4d46');
    } catch {
        return false;
    }
}

/** Extrait le premier frame d'un WebP animé via sharp */
async function extractFirstFrameFromWebP(buffer) {
    try {
        const sharp = await import('sharp');
        return await sharp.default(buffer, { animated: true, page: 0 })
            .png()
            .toBuffer();
    } catch (err) {
        console.warn('⚠️ Extraction du frame échouée :', err.message);
        return null;
    }
}

/** Convertit un WebP animé en WebM via ffmpeg */
async function convertToWebM(buffer) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const tempDir = await ensureTempDir();
    const inputPath  = path.join(tempDir, `in_${Date.now()}.webp`);
    const outputPath = path.join(tempDir, `out_${Date.now()}.webm`);

    try {
        await fs.writeFile(inputPath, buffer);

        await execAsync(
            `ffmpeg -i "${inputPath}" -c:v libvpx-vp9 -pix_fmt yuv420p ` +
            `-b:v 1M -crf 30 -speed 4 -row-mt 1 -t 5 -y "${outputPath}"`,
            { timeout: 15000 }
        );

        const videoBuffer = await fs.readFile(outputPath);

        if (videoBuffer.length < 500) throw new Error('WebM trop petit, conversion ratée');

        return videoBuffer;

    } catch (err) {
        console.warn('⚠️ WebM échoué, fallback MP4 :', err.message);
        return await createSimpleVideo(buffer);

    } finally {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
    }
}

/** Crée une vidéo MP4 simple (sticker statique → 3 sec) */
async function createSimpleVideo(buffer) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const sharp = await import('sharp');

    const tempDir = await ensureTempDir();
    const imagePath = path.join(tempDir, `frame_${Date.now()}.png`);
    const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

    try {
        // Normaliser le sticker en PNG 512×512
        const pngBuffer = await sharp.default(buffer)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();

        await fs.writeFile(imagePath, pngBuffer);

        await execAsync(
            `ffmpeg -loop 1 -i "${imagePath}" -c:v libx264 -t 3 ` +
            `-pix_fmt yuv420p -vf "scale=512:512" -r 10 -y "${videoPath}"`,
            { timeout: 15000 }
        );

        const videoBuffer = await fs.readFile(videoPath);

        if (videoBuffer.length < 500) throw new Error('MP4 trop petit');

        return videoBuffer;

    } catch (err) {
        console.warn('⚠️ Création MP4 échouée, retour du buffer brut :', err.message);
        // Dernier recours : renvoyer le buffer WebP tel quel
        return buffer;

    } finally {
        await fs.unlink(imagePath).catch(() => {});
        await fs.unlink(videoPath).catch(() => {});
    }
}

/** Crée et retourne le chemin du dossier temporaire */
async function ensureTempDir() {
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
};