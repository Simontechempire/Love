const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('alip-baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const { getBuffer, formatUptime } = require('./Lib/function');

const app = express();
const PORT = config.port;

// Express - Keep Render Alive
app.get('/', (req, res) => {
  res.send(`
    <html><head><title>Love Bot</title></head>
    <body style="background:#111;color:#fff;text-align:center;font-family:sans-serif;padding:50px">
      <img src="${config.botPic}" style="width:200px;border-radius:50%" />
      <h1>💖 LOVE BOT - Online</h1>
      <p>Owner: ${config.ownerName}</p>
      <p>Prefix: ${config.prefix}</p>
      <p>Pairing Only - No QR</p>
    </body></html>
  `);
});
app.listen(PORT, () => console.log(`[LOVE] Web on ${PORT}`));

// Load Plugins
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
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // NO QR - Pairing Only
    browser: ['Love', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing Code - Owner only
  if (!sock.authState.creds.registered) {
    const phone = config.ownerNumber.replace(/[^0-9]/g, '');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`\n========== LOVE PAIRING CODE ==========`);
        console.log(`Phone: ${phone}`);
        console.log(`CODE: ${code}`);
        console.log(`Go WhatsApp > Linked Devices > Link with phone number`);
        console.log(`========================================\n`);
      } catch (e) { console.log('[PAIRING ERROR]', e.message); }
    }, 3000);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('[LOVE] Connected ✅');

      // Auto DP - Set Love PFP
      try {
        const pic = await getBuffer(config.botPic);
        if (pic) {
          await sock.updateProfilePicture(sock.user.id, pic);
          console.log('[LOVE] DP Updated ✅');
        }
      } catch (e) { console.log('[DP ERROR]', e.message); }

      // Auto Bio + Name
      try {
        await sock.updateProfileStatus(`💖 ${config.botName} Bot | Owner: ${config.ownerName} | Prefix: ${config.prefix}menu`);
        await sock.updateProfileName(config.botName);
      } catch {}

      // Startup Msg to Owner
      try {
        await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', {
          image: { url: config.botPic },
          caption: `◈┈▉ *Love* ▉┄◈\n\n✅ *LOVE is Online!*\n\n> ➠ *Owner:* ${config.ownerName}\n> ➠ *Uptime:* ${formatUptime(process.uptime() * 1000)}\n> ➠ *Plugins:* ${plugins.length}\n> ➠ *Prefix:* ${config.prefix}\n\nType *${config.prefix}menu* to see commands.`
        });
      } catch {}
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('[LOVE] Disconnected, reconnecting...', reason);
      if (reason !== DisconnectReason.loggedOut) startLove();
      else console.log('[LOVE] Logged out - Delete auth_love & re-pair');
    }
  });

  // Messages
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
    // Support .ᴍᴇɴᴜ style - normalize
    const normalized = cmdName.normalize('NFKD').toLowerCase();

    // Find plugin - check name + alias
    const plugin = plugins.find(p => {
      const n = p.name.toLowerCase();
      // For fancy font commands, match by lowercasing
      return n === normalized || n === cmdName;
    }) || plugins.find(p => p.name.toLowerCase() === 'menu' && (cmdName === 'menu' || cmdName === 'ᴍᴇɴᴜ'));

    if (!plugin) return;

    try {
      await plugin.run({ sock, from, msg, sender, pushName, args, text: args.join(' '), pluginCount: plugins.length, config });
    } catch (e) {
      console.log(`[CMD ERROR] ${cmdName}:`, e.message);
      await sock.sendMessage(from, { text: `❌ Error: ${e.message}` });
    }
  });
}

startLove();
