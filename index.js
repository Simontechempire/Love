// LOVE - INDEX.JS - SIMON TECH INC
// Fully connected: config + public + lib/function + lib/menu + plugins + auto/anti

require('dotenv').config();

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

// ===== LOAD CONFIG =====
let config;
try {
  config = require('./config');
} catch {
  config = {
    botName: "Love",
    ownerName: "Simon Tech",
    ownerNumber: "2348071569915",
    prefix: ".",
    sessionFolder: "./auth_love",
    port: process.env.PORT || 3000,
    mode: "public"
  };
}

// Normalize config for compatibility
config.ownerNumber = String(config.ownerNumber || "2348071569915").replace(/[^0-9]/g, '');
config.botName = config.botName || "Love";
config.prefix = config.prefix || ".";
config.sessionName = (config.sessionFolder || config.sessionName || "./auth_love").replace(/^\.\//, '');
config.PORT = config.port || config.PORT || process.env.PORT || 3000;

// ===== LOAD LIB =====
let func = {};
try {
  func = require('./lib/function');
} catch (e) {
  console.log(chalk.yellow('lib/function.js not found, using fallbacks'));
}

const { getMenu } = (() => {
  try {
    return require('./lib/menu');
  } catch {
    return { getMenu: () => 'Menu not available' };
  }
})();

// ===== SIMPLE CACHE =====
const msgRetryCounterCache = {
  _cache: new Map(),
  get(k) { return this._cache.get(k); },
  set(k, v) { this._cache.set(k, v); return v; },
  del(k) { this._cache.delete(k); },
  has(k) { return this._cache.has(k); }
};

// ===== GLOBALS =====
global.sock = null;
global.isConnected = false;
global.connectionStatus = '⚠️ NOT LINKED';
global.pairingCode = null;
global.currentPairingNumber = null;
global.appStarted = false;
global.config = config;

global.db = global.db || {};
global.db.groups = global.db.groups || {};
global.db.settings = global.db.settings || {
  prefix: config.prefix || ".",
  mode: config.mode || "public",
  autoread: config.readmsg || false,
  autostatus: config.readstatus || false,
  autovv: config.vvcmd || true,
  anticall: config.rejectcall || true,
  antidelete: config.antidelete || false,
  cmdreact: config.cmdreact || false
};
global.db.banned = global.db.banned || [];
global.db.messages = global.db.messages || {};
global.db.sudo = global.db.sudo || [
  config.ownerNumber + '@s.whatsapp.net',
  "2348071569915@s.whatsapp.net"
];

// Load DB from lib if available
if (func.loadDB) {
  try {
    const loaded = func.loadDB();
    if (loaded) {
      global.db = { ...global.db, ...loaded };
      if (loaded.settings) global.db.settings = { ...global.db.settings, ...loaded.settings };
    }
  } catch {}
}

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

// ===== PLUGIN LOADER =====
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
    console.log(chalk.red('❌ No plugins folder found'));
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
            // Support multiple plugin styles
            if (pl && pl.name && (pl.execute || pl.run || pl.handler)) {
              const exec = pl.execute || pl.run || pl.handler;
              const name = pl.name.toLowerCase();

              global.plugins.set(name, { ...pl, execute: exec });
              global.wolfCommands[name] = exec;
              global.loveCommands[name] = exec;

              const aliases = pl.alias || pl.aliases || [];
              for (const a of aliases) {
                const al = String(a).toLowerCase();
                global.plugins.set(al, { ...pl, execute: exec });
                global.wolfCommands[al] = exec;
                global.loveCommands[al] = exec;
              }
              total++;
            } else if (pl && pl.command && pl.execute) {
              // Alternative style: { command: ['menu'], execute }
              for (const cmd of (Array.isArray(pl.command) ? pl.command : [pl.command])) {
                const clean = String(cmd).toLowerCase();
                global.plugins.set(clean, pl);
                global.wolfCommands[clean] = pl.execute;
                global.loveCommands[clean] = pl.execute;
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
  console.log(chalk.green(`✅ LOVE loaded ${total} plugins | ${Object.keys(global.wolfCommands).length} commands from ${pPath}`));
}

loadPlugins();

// ===== START CONNECTION =====
async function startConnection() {
  // ===== EXPRESS SERVER =====
  if (!global.appStarted) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(__dirname));

    // Serve pairing page
    app.get('/', (req, res) => {
      const idx = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(idx)) return res.sendFile(idx);
      res.send(`<h1>LOVE</h1><p>Owner: ${config.ownerNumber}</p>`);
    });

    // Status endpoint (used by public/index.html)
    app.get('/status', (req, res) => {
      res.json({
        botName: config.botName || "Love",
        owner: config.ownerNumber,
        status: global.connectionStatus,
        connected: global.isConnected,
        isConnected: global.isConnected,
        pairingCode: global.pairingCode,
        commands: Object.keys(global.wolfCommands).length,
        mode: global.db.settings.mode || "public"
      });
    });

    app.get('/api/status', (req, res) => {
      res.json({
        botName: config.botName || "Love",
        owner: config.ownerNumber,
        status: global.connectionStatus,
        connected: global.isConnected,
        isConnected: global.isConnected,
        pairingCode: global.pairingCode,
        commands: Object.keys(global.wolfCommands).length
      });
    });

    // Pairing function
    async function doPair(phone, res) {
      try {
        phone = (phone || '').replace(/[^0-9]/g, '');
        if (phone.length < 10) {
          return res.json({ success: false, error: 'Enter valid number e.g 2348071569915', message: 'Enter valid number' });
        }
        if (!global.sock) {
          return res.json({ success: false, error: 'Bot starting... wait 5 sec', message: 'Bot starting...' });
        }
        if (global.isConnected) {
          return res.json({ success: false, error: 'Already linked!', message: 'Already linked!' });
        }

        const code = await global.sock.requestPairingCode(phone);
        global.pairingCode = code;
        global.currentPairingNumber = phone;
        global.connectionStatus = `CODE: ${code}`;
        console.log(chalk.yellow(`🔑 LOVE CODE ${phone}: ${code}`));
        return res.json({ success: true, code, phone });
      } catch (e) {
        console.log(chalk.red('Pair error:'), e.message);
        return res.json({ success: false, error: e.message, message: e.message });
      }
    }

    // Pairing routes (compatible with public/index.html)
    app.get('/pair', async (req, res) => {
      await doPair(req.query.number || req.query.phone || '', res);
    });
    app.get('/getcode', async (req, res) => {
      await doPair(req.query.number || req.query.phone || '', res);
    });
    app.get('/pair-code', async (req, res) => {
      await doPair(req.query.number || req.query.phone || '', res);
    });
    app.post('/api/pair', async (req, res) => {
      await doPair(req.body.phone || req.body.number || '', res);
    });

    // Logout / clear session
    app.get('/clear-session', async (req, res) => {
      try {
        if (global.sock) await global.sock.logout().catch(() => {});
      } catch {}
      try {
        fs.rmSync(`./${config.sessionName}`, { recursive: true, force: true });
      } catch {}
      global.sock = null;
      global.isConnected = false;
      global.connectionStatus = 'Session cleared';
      res.json({ success: true, message: 'Session cleared. Restart and pair again.' });
      setTimeout(() => initBaileys(), 2000);
    });

    const PORT = config.PORT || process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(chalk.cyan(`🌐 LOVE Dashboard → http://localhost:${PORT}`));
      console.log(chalk.cyan(`📦 Commands loaded: ${Object.keys(global.wolfCommands).length}`));
    });
    global.appStarted = true;
  }

  // ===== BAILEYS INIT =====
  async function initBaileys() {
    try {
      const authPath = `./${config.sessionName}`;
      const { state, saveCreds } = await useMultiFileAuthState(authPath);
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
        markOnlineOnConnect: config.alwaysOnline || false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false,
        msgRetryCounterCache,
        getMessage: async () => undefined
      });

      global.sock = sock;
      sock.ev.on('creds.update', saveCreds);

      // ===== ANTI-CALL =====
      sock.ev.on('call', async (calls) => {
        for (const c of calls) {
          try {
            if (global.db.settings.anticall || config.rejectcall) {
              await sock.rejectCall(c.id, c.from);
              console.log(chalk.yellow(`📞 Rejected call from ${c.from}`));
            }
          } catch {}
        }
      });

      // ===== ANTI-DELETE =====
      sock.ev.on('messages.update', async (updates) => {
        for (const up of updates) {
          if (up.update.message === null) {
            const saved = global.db.messages[up.key.id];
            if (!saved) continue;

            const g = getGroup(saved.from);
            const antiDeleteOn = global.db.settings.antidelete || g.antidelete || config.antidelete;

            if (!antiDeleteOn) continue;

            try {
              await sock.sendMessage(saved.from, {
                text: `*🔍 ANTI-DELETE*\n\nFrom: @\( {saved.sender.split('@')[0]}\nMessage:\n \){(saved.text || '').slice(0, 400)}`,
                mentions: [saved.sender]
              });
            } catch {}
          }
        }
      });

      // ===== CONNECTION UPDATE =====
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
          global.connectionStatus = 'Connecting LOVE...';
          console.log(chalk.yellow('⏳ Connecting...'));
        }

        if (connection === 'open') {
          global.isConnected = true;
          global.connectionStatus = 'ONLINE ✅ LOVE';
          console.log(chalk.green.bold(`\n✅ LOVE ONLINE! ${Object.keys(global.wolfCommands).length} CMDS\n`));
          loadPlugins(); // reload plugins on reconnect

          try {
            await new Promise(r => setTimeout(r, 2500));
            await sock.sendMessage(sock.user.id, {
              text: `✅ *LOVE LINKED*\n\n👤 ${sock.user.name || config.ownerName}\n🔣 Prefix: ${config.prefix}\n⚡ \( {Object.keys(global.wolfCommands).length} Commands\n\nType * \){config.prefix}menu*`
            }).catch(() => {});
          } catch {}
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          console.log(chalk.red(`❌ Connection closed: ${code}`));
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

      // ===== MAIN MESSAGE HANDLER =====
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
          if (type !== 'notify') return;
          const m = messages[0];
          if (!m?.message) return;

          const from = m.key.remoteJid;

          // Status auto-read
          if (from === 'status@broadcast') {
            if (global.db.settings.autostatus || config.readstatus) {
              await sock.readMessages([m.key]).catch(() => {});
            }
            return;
          }

          const sender = m.key.participant || from;
          const isGroup = from.endsWith('@g.us');

          // Get text body
          let body =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            m.message.imageMessage?.caption ||
            m.message.videoMessage?.caption ||
            m.message.documentMessage?.caption ||
            "";

          // Use lib/function getText if available
          if (func.getText) {
            try {
              const t = func.getText(m);
              if (t) body = t;
            } catch {}
          }

          // Save for anti-delete
          if (m.key.id) {
            global.db.messages[m.key.id] = {
              text: body,
              sender,
              from,
              time: Date.now()
            };
            if (Object.keys(global.db.messages).length > 200) {
              delete global.db.messages[Object.keys(global.db.messages)[0]];
            }
          }

          // Auto read
          if (global.db.settings.autoread || config.readmsg) {
            await sock.readMessages([m.key]).catch(() => {});
          }

          // ViewOnce auto
          if (isGroup) {
            const g = getGroup(from);
            if ((global.db.settings.autovv || g.antiviewonce) &&
              (m.message.viewOnceMessage || m.message.viewOnceMessageV2 || m.message.viewOnceMessageV2Extension)) {
              try {
                const q = m.message.viewOnceMessage || m.message.viewOnceMessageV2 || m.message.viewOnceMessageV2Extension;
                const inner = q?.message || q;
                if (inner?.imageMessage) {
                  await sock.sendMessage(from, { image: inner.imageMessage }, { quoted: m }).catch(() => {});
                } else if (inner?.videoMessage) {
                  await sock.sendMessage(from, { video: inner.videoMessage }, { quoted: m }).catch(() => {});
                }
              } catch {}
            }
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
            if (typeof fn === 'function') {
              plugin = { execute: fn };
            }
          }

          if (!plugin) return;

          // Ban check
          if (global.db.banned.includes(sender) || global.db.banned.includes(sender.split('@')[0])) return;

          // Enrich message
          m.body = body;
          m.text = args.join(' ');
          m.args = args;
          m.sender = sender;
          m.chat = from;
          m.from = from;
          m.isGroup = isGroup;
          m.fromMe = m.key.fromMe;
          m.pushName = m.pushName || "User";

          // Owner check (compatible with lib/function)
          m.isOwner =
            sender.includes(config.ownerNumber) ||
            global.db.sudo.includes(sender) ||
            m.key.fromMe ||
            (func.isOwnerMessage && func.isOwnerMessage(m, global.db, config));

          m.reply = async (txt) => {
            return await sock.sendMessage(from, { text: String(txt) }, { quoted: m });
          };

          m.download = async () => {
            return await downloadMediaMessage(m, 'buffer', {}, {
              logger: pino({ level: "silent" }),
              reuploadRequest: sock.updateMediaMessage
            });
          };

          // Command react
          if (global.db.settings.cmdreact || config.cmdreact) {
            await sock.sendMessage(from, { react: { text: '⚡', key: m.key } }).catch(() => {});
          }

          console.log(chalk.green(`▶️ ${rawCmd} | ${sender.split('@')[0]}`));

          // Execute
          const execFn = typeof plugin === 'function' ? plugin : (plugin.execute || plugin.run || plugin.handler);

          if (typeof execFn === 'function') {
            // Support different plugin call styles
            try {
              // Style 1: (sock, m, ctx)
              await execFn(sock, m, {
                command: cmdName,
                text: args.join(' '),
                args,
                reply: m.reply,
                isOwner: m.isOwner,
                prefix,
                config,
                db: global.db,
                func,
                getMenu
              });
            } catch (err1) {
              try {
                // Style 2: ({ sock, m, ... })
                await execFn({
                  sock,
                  m,
                  from,
                  sender,
                  args,
                  text: args.join(' '),
                  command: cmdName,
                  prefix,
                  isOwner: m.isOwner,
                  config,
                  db: global.db,
                  reply: m.reply,
                  func,
                  getMenu
                });
              } catch (err2) {
                console.log(chalk.red(`Exec error [${rawCmd}]: ${err1.message || err2.message}`));
              }
            }
          }

        } catch (e) {
          console.log(chalk.red(`Handler error: ${e.message}`));
        }
      });

    } catch (e) {
      console.log(chalk.red('Baileys init error:'), e.message);
      setTimeout(() => initBaileys(), 5000);
    }
  }

  await initBaileys();
}

module.exports = { startConnection };

if (require.main === module) {
  console.log(chalk.magentaBright('\n🚀 Starting LOVE Bot...\n'));
  startConnection().catch(e => {
    console.log(chalk.red(e.message));
    setTimeout(() => startConnection(), 4000);
  });
}
