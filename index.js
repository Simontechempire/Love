// LOVE - INDEX.JS - SIMON TECH INC
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const chalk = require('chalk');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Simple cache
const msgRetryCounterCache = {
  _cache: new Map(),
  get(k) { return this._cache.get(k); },
  set(k, v) { this._cache.set(k, v); return v; },
  del(k) { this._cache.delete(k); },
  has(k) { return this._cache.has(k); }
};

// Config
let config;
try {
  config = require('./config');
} catch {
  config = {
    botName: "LOVE",
    ownerName: "Simon Tech",
    ownerNumber: "2348071569915",
    prefix: ".",
    sessionName: "auth_love",
    PORT: process.env.PORT || 10000
  };
}
config.ownerNumber = config.ownerNumber || "2348071569915";
config.botName = "LOVE";
config.sessionName = config.sessionFolder || config.sessionName || "auth_love";
if (!config.prefix) config.prefix = ".";

// Globals
global.sock = null;
global.isConnected = false;
global.connectionStatus = '⚠️ NOT LINKED';
global.pairingCode = null;
global.currentPairingNumber = null;
global.appStarted = false;

global.db = global.db || {};
global.db.groups = global.db.groups || {};
global.db.settings = global.db.settings || {
  prefix: ".",
  mode: "public",
  autoread: false,
  autostatus: true,
  autovv: true,
  anticall: true
};
global.db.banned = global.db.banned || [];
global.db.messages = global.db.messages || {};
global.db.sudo = global.db.sudo || [
  config.ownerNumber + '@s.whatsapp.net',
  "2348071569915@s.whatsapp.net"
];

function getGroup(jid) {
  global.db.groups[jid] = global.db.groups[jid] || {
    antilink: false,
    antibot: false,
    antispam: false,
    antiviewonce: true,
    antidelete: true,
    welcome: false,
    goodbye: false
  };
  return global.db.groups[jid];
}

global.plugins = new Map();
global.wolfCommands = {};
global.loveCommands = {};

// ============ PLUGIN LOADER ============
function loadPlugins() {
  const possiblePaths = [
    path.join(__dirname, 'plugins'),
    path.join(__dirname, '../plugins'),
    path.join(__dirname, 'src/plugins')
  ];
  
  let pPath = null;
  for (const pp of possiblePaths) {
    if (fs.existsSync(pp)) {
      pPath = pp;
      break;
    }
  }
  
  if (!pPath) {
    console.log(chalk.red('No plugins folder found'));
    return;
  }

  global.plugins.clear();
  global.wolfCommands = {};
  global.loveCommands = {};
  
  let total = 0;
  const IGNORED = ['main.js', 'index.js', 'connection.js', 'settings.js', 'config.js', 'app.js', 'bot.js', 'server.js'];

  function readDir(dir) {
    const items = fs.readdirSync(dir);
    for (const it of items) {
      const full = path.join(dir, it);
      const st = fs.statSync(full);
      
      if (st.isDirectory()) {
        if (it === 'node_modules' || it.startsWith('.') || IGNORED.includes(it)) continue;
        readDir(full);
      } else if (it.endsWith('.js')) {
        if (IGNORED.includes(it)) continue;
        try {
          delete require.cache[require.resolve(full)];
          const data = require(full);
          const arr = Array.isArray(data) ? data : [data];
          
          for (const pl of arr) {
            if (pl && pl.name && pl.execute) {
              global.plugins.set(pl.name.toLowerCase(), pl);
              global.wolfCommands[pl.name.toLowerCase()] = pl.execute;
              global.loveCommands[pl.name.toLowerCase()] = pl.execute;
              
              if (pl.alias) {
                for (const a of pl.alias) {
                  global.plugins.set(a.toLowerCase(), pl);
                  global.wolfCommands[a.toLowerCase()] = pl.execute;
                  global.loveCommands[a.toLowerCase()] = pl.execute;
                }
              }
              total++;
            }
          }
        } catch (e) {
          console.log(chalk.red(`Load error ${it}: ${e.message}`));
        }
      }
    }
  }

  readDir(pPath);
  console.log(chalk.green(`✅ LOVE loaded ${total} plugins | ${Object.keys(global.wolfCommands).length} commands`));
}

loadPlugins();

// ============ CONNECTION ============
async function startConnection() {
  if (!global.appStarted) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(__dirname));

    app.get('/', (req, res) => {
      const idx = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(idx)) return res.sendFile(idx);
      res.send(`<h1>LOVE</h1><p>Owner: 2348071569915</p>`);
    });

    app.get('/api/status', (req, res) => {
      res.json({
        botName: "LOVE",
        owner: "2348071569915",
        status: global.connectionStatus,
        isConnected: global.isConnected,
        pairingCode: global.pairingCode,
        commands: Object.keys(global.wolfCommands).length
      });
    });

    async function doPair(phone, res) {
      try {
        phone = (phone || '').replace(/[^0-9]/g, '');
        if (phone.length < 10) {
          return res.json({ success: false, message: 'Enter valid number e.g 2348071569915' });
        }
        if (!global.sock) {
          return res.json({ success: false, message: 'Bot starting... wait 5 sec' });
        }
        if (global.isConnected) {
          return res.json({ success: false, message: 'Already linked!' });
        }
        
        const code = await global.sock.requestPairingCode(phone);
        global.pairingCode = code;
        global.currentPairingNumber = phone;
        global.connectionStatus = `CODE: ${code}`;
        console.log(chalk.yellow(`🔑 LOVE CODE ${phone}: ${code}`));
        return res.json({ success: true, code, phone });
      } catch (e) {
        return res.json({ success: false, message: e.message });
      }
    }

    app.post('/api/pair', async (req, res) => {
      await doPair(req.body.phone || req.body.number || '', res);
    });
    app.get('/getcode', async (req, res) => {
      await doPair(req.query.number || req.query.phone || '', res);
    });
    app.get('/pair', async (req, res) => {
      await doPair(req.query.number || req.query.phone || '', res);
    });

    const PORT = config.PORT || process.env.PORT || 10000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(chalk.cyan(`🌐 LOVE Dashboard → http://localhost:${PORT}`));
    });
    global.appStarted = true;
  }

  async function initBaileys() {
    const { state, saveCreds } = await useMultiFileAuthState(`./${config.sessionName}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Safari'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      syncFullHistory: false,
      msgRetryCounterCache,
      getMessage: async () => undefined
    });

    global.sock = sock;
    sock.ev.on('creds.update', saveCreds);

    // Anti-call
    sock.ev.on('call', async (calls) => {
      for (let c of calls) {
        try {
          if (global.db.settings.anticall) await sock.rejectCall(c.id, c.from);
        } catch {}
      }
    });

    // Connection update
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'connecting') {
        global.connectionStatus = 'Connecting LOVE...';
      }
      
      if (connection === 'open') {
        global.isConnected = true;
        global.connectionStatus = 'ONLINE ✅ LOVE';
        console.log(chalk.green.bold(`\n✅ LOVE ONLINE! ${Object.keys(global.wolfCommands).length} CMDS\n`));
        loadPlugins();
        
        try {
          await new Promise(r => setTimeout(r, 2000));
          await sock.sendMessage(sock.user.id, {
            text: `✅ *LOVE LINKED*\n\nPrefix: .\nCommands: ${Object.keys(global.wolfCommands).length}\n\nType *.menu*`
          }).catch(() => {});
        } catch {}
      }
      
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(chalk.red(`❌ Closed ${code}`));
        global.isConnected = false;
        global.sock = null;
        
        if ([DisconnectReason.loggedOut, 401, 440, 405].includes(code)) {
          try {
            fs.rmSync(`./${config.sessionName}`, { recursive: true, force: true });
          } catch {}
          global.connectionStatus = 'LOGGED OUT';
          setTimeout(() => initBaileys(), 3000);
        } else {
          global.connectionStatus = 'Reconnecting...';
          setTimeout(() => initBaileys(), 5000);
        }
      }
    });

    // ============ REAL COMMAND HANDLER ============
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m?.message) return;

        const from = m.key.remoteJid;
        if (from === 'status@broadcast') {
          if (global.db.settings.autostatus) {
            await sock.readMessages([m.key]).catch(() => {});
          }
          return;
        }

        const sender = m.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        const body =
          m.message.conversation ||
          m.message.extendedTextMessage?.text ||
          m.message.imageMessage?.caption ||
          m.message.videoMessage?.caption ||
          "";

        // Save message for anti-delete
        if (m.key.id) {
          global.db.messages[m.key.id] = {
            text: body,
            sender,
            from,
            time: Date.now()
          };
          if (Object.keys(global.db.messages).length > 150) {
            delete global.db.messages[Object.keys(global.db.messages)[0]];
          }
        }

        if (global.db.settings.autoread) {
          await sock.readMessages([m.key]).catch(() => {});
        }

        if (!body) return;

        const prefix = global.db.settings.prefix || config.prefix || '.';
        if (!body.trim().startsWith(prefix)) return;

        const args = body.trim().slice(prefix.length).trim().split(/ +/);
        const rawCmd = args.shift()?.toLowerCase();
        if (!rawCmd) return;

        const cmdName = rawCmd.replace(/[^a-z0-9]/g, '') || rawCmd;

        // Find plugin
        let plugin = global.plugins.get(rawCmd) || global.plugins.get(cmdName);
        
        if (!plugin) {
          const fn = global.wolfCommands[rawCmd] || global.wolfCommands[cmdName];
          if (fn && typeof fn === 'function') {
            plugin = { execute: fn };
          }
        }

        if (!plugin) return;
        if (global.db.banned.includes(sender)) return;

        // Enrich message object
        m.body = body;
        m.text = args.join(' ');
        m.args = args;
        m.sender = sender;
        m.chat = from;
        m.from = from;
        m.isGroup = isGroup;
        m.fromMe = m.key.fromMe;
        m.pushName = m.pushName || "User";
        m.isOwner = sender.includes(config.ownerNumber) || global.db.sudo.includes(sender) || m.key.fromMe;
        
        m.reply = async (txt) => {
          return await sock.sendMessage(from, { text: txt }, { quoted: m });
        };

        m.download = async () => {
          return await downloadMediaMessage(m, 'buffer', {}, {
            logger: pino({ level: "silent" }),
            reuploadRequest: sock.updateMediaMessage
          });
        };

        console.log(chalk.green(`▶️ ${rawCmd} | ${sender.split('@')[0]}`));

        // Execute command
        const execFn = typeof plugin === 'function' ? plugin : plugin.execute;
        if (typeof execFn === 'function') {
          await execFn(sock, m, {
            command: cmdName,
            text: args.join(' '),
            args,
            reply: m.reply,
            isOwner: m.isOwner,
            prefix
          });
        }

      } catch (e) {
        console.log(chalk.red(`Exec error: ${e.message}`));
      }
    });
  }

  await initBaileys();
}

module.exports = { startConnection };

if (require.main === module) {
  startConnection().catch(e => {
    console.log(e.message);
    setTimeout(() => startConnection(), 3000);
  });
            }
