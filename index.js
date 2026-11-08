const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('alip-baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getBuffer, formatUptime } = require('./Lib/function');

const app = express();
const PORT = config.port;
app.use(express.static(path.join(__dirname, 'Public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Public', 'index.html')));
app.listen(PORT, () => console.log(`[LOVE] Web on ${PORT}`));

function loadPlugins() {
  const plugins = [];
  const dir = path.join(__dirname, 'Plugins');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(dir, file))];
      const plugin = require(path.join(dir, file));
      if (plugin.name) plugins.push(plugin);
    } catch (e) { console.log(`[PLUGIN ERROR] ${file}:`, e.message); }
  }
  console.log(`[LOVE] Loaded ${plugins.length} plugins`);
  return plugins;
}
let plugins = loadPlugins();

async function startLove() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Love', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    const phone = config.ownerNumber.replace(/[^0-9]/g, '');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`\n========== LOVE PAIRING CODE ==========\nPhone: ${phone}\nCODE: ${code}\n========================================\n`);
      } catch (e) { console.log('[PAIRING ERROR]', e.message); }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'open') {
      console.log('[LOVE] Connected ✅');
      try {
        const pic = await getBuffer(config.botPic);
        if (pic) await sock.updateProfilePicture(sock.user.id, pic);
      } catch {}
      try {
        await sock.updateProfileStatus(`💖 ${config.botName} Bot | Owner: ${config.ownerName} | Prefix: ${config.prefix}menu`);
        await sock.updateProfileName(config.botName);
      } catch {}
      try {
        await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', {
          image: { url: config.botPic },
          caption: `◈┈▉ *Love* ▉┄◈\n\n✅ *LOVE is Online!*\n\n> ➠ *Owner:* ${config.ownerName}\n> ➠ *Uptime:* ${formatUptime(process.uptime() * 1000)}\n> ➠ *Plugins:* ${plugins.length}\n> ➠ *Prefix:* ${config.prefix}\n\nType *${config.prefix}menu* to see commands.`
        });
      } catch {}
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) startLove();
      else console.log('[LOVE] Logged out - Delete auth_love & re-pair');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || 'User';
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';
    if (!body.startsWith(config.prefix)) return;
    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const normalized = cmdName.normalize('NFKD').toLowerCase();
    const plugin = plugins.find(p => p.name.toLowerCase() === normalized || p.name.toLowerCase() === cmdName) || plugins.find(p => p.name.toLowerCase() === 'menu' && (cmdName === 'menu' || cmdName === 'ᴍᴇɴᴜ'));
    if (!plugin) return;
    try {
      await plugin.run({ sock, from, msg, sender, pushName, args, text: args.join(' '), pluginCount: plugins.length, config });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Error: ${e.message}` });
    }
  });
}
startLove();
