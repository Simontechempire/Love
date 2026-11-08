const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const config = require("./config");

// gcstatus - optional, if file no dey, no crash
let gcStatus = null;
try { gcStatus = require("./gcstatus"); } catch { console.log("[WARN] gcstatus.js not found, skip"); }

// ===== LOVE PLUGINS - inside your method =====
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }
function readJson(file, def){ try{ if(fs.existsSync(file)) return JSON.parse(fs.readFileSync(file)); }catch{} return def; }
function writeJson(file, data){ ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function normalize(str){
  if(!str) return '';
  const map = { 'ᴀ':'a','ʙ':'b','ᴄ':'c','ᴅ':'d','ᴇ':'e','ꜰ':'f','ɢ':'g','ʜ':'h','ɪ':'i','ᴊ':'j','ᴋ':'k','ʟ':'l','ᴍ':'m','ɴ':'n','ᴏ':'o','ᴘ':'p','ǫ':'q','ʀ':'r','ꜱ':'s','ᴛ':'t','ᴜ':'u','ᴠ':'v','ᴡ':'w','x':'x','ʏ':'y','ᴢ':'z' };
  let out = '';
  for(const ch of str.toLowerCase()) out += map[ch] || ch;
  return out.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function loadPlugins(){
  const list = [];
  let dir = path.join(__dirname, 'Plugins');
  if(!fs.existsSync(dir) && fs.existsSync(path.join(__dirname, 'plugins'))) dir = path.join(__dirname, 'plugins');
  if(!fs.existsSync(dir)) return list;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for(const file of files){
    try{
      delete require.cache[require.resolve(path.join(dir, file))];
      const mod = require(path.join(dir, file));
      const arr = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : mod?.name ? [mod] : [];
      for(const p of arr){ if(p?.name && typeof p.run === 'function') list.push(p); }
    }catch(e){ console.log(`[PLUGIN ERROR] ${file}:`, e.message); }
  }
  console.log(`[LOVE] Loaded ${list.length} plugins from ${files.length} files`);
  return list;
}
let plugins = loadPlugins();
setInterval(()=>{ plugins = loadPlugins(); }, 60000);

// Lib/function - optional fallback
let getBuffer, formatUptime;
try { ({ getBuffer, formatUptime } = require('./Lib/function')); } catch { try { ({ getBuffer, formatUptime } = require('./lib/function')); } catch { getBuffer = async()=>null; formatUptime = (ms)=> Math.floor(ms/1000)+'s'; } }

const app = express();
app.use(express.json());
app.use(express.static("public"));
let sock;
let isStarting = false;
let sockState = 'starting';

async function startBot() {
  if (sock) return sock;
  if (isStarting) {
    while (isStarting) await new Promise(r => setTimeout(r, 500));
    return sock;
  }
  isStarting = true;
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder || "session");
  sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }), printQRInTerminal: false, browser: ['Love', 'Chrome', '1.0.0'] });
  sockState = 'connecting';
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (u) => {
    sockState = u.connection || sockState;
    console.log('[CONN]', u.connection, u.lastDisconnect?.error?.output?.statusCode || '');
    if (u.connection === "open") { sockState = 'open'; console.log("✅ Connected - LOVE Ready"); }
    if (u.connection === "close") {
      sockState = 'close';
      const re = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const code = u.lastDisconnect?.error?.output?.statusCode;
      sock = null;
      isStarting = false;
      // 401 = bad session, clear am so next start go fresh
      if (code === 401 || !re) {
        try { fs.rmSync(path.join(__dirname, config.sessionFolder || "session"), { recursive: true, force: true }); console.log('[LOVE] Cleared bad session'); } catch {}
      }
      if (re || code === 401) setTimeout(()=>startBot(), 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;
    const m = msg.message;
    const mtype = Object.keys(m)[0];
    const content = m[mtype];
    const body = m.conversation || content?.text || content?.caption || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || "";
    const text = body.toLowerCase().trim();

    // FIX SPAM LOOP: Ignore bot's own replies - YOUR METHOD
    if (body.startsWith("❌") || body.startsWith("⏳") || body.startsWith("Pong") || body.startsWith("Order Complete") || body.startsWith("✅")) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.participant) : from;
    const pushName = msg.pushName || 'User';

    if (text === ".ping") {
      await sock.sendMessage(from, { text: "Pong! ✅ LOVE BOT is alive" });
      return;
    }
    if (text.includes(".gcstatus") && gcStatus) {
      await gcStatus(sock, msg, config);
      return;
    }

    // ===== LOVE COMMANDS - inside your messages.upsert =====
    if (!body.startsWith(config.prefix)) return;
    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const cmdName = normalize(args.shift() || '');
    const plugin = plugins.find(p => normalize(p.name) === cmdName || (p.alias||[]).some(a => normalize(a) === cmdName));
    if (!plugin) return;

    // Build msg object plugins expect
    const quotedMsg = content?.contextInfo?.quotedMessage;
    const quoted = quotedMsg ? { key: { remoteJid: from, id: content?.contextInfo?.stanzaId, participant: content?.contextInfo?.participant }, message: quotedMsg, mtype: Object.keys(quotedMsg)[0], text: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', caption: quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', sender: content?.contextInfo?.participant } : null;
    const msgObj = { ...msg, mtype, text: body, body, sender, from, pushName, mentionedJid: content?.contextInfo?.mentionedJid || [], quoted };

    const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
    const isOwner = sender.split('@')[0] === config.ownerNumber || (cfg.sudo||[]).includes(sender) || (config.ownerNumbers||[]).includes(sender.split('@')[0]);
    const isMod = (cfg.mods||[]).includes(sender);
    if(cfg.mode === 'private' && !isOwner && !isMod) return;
    if(cfg.mode === 'self' && !isOwner) return;

    try {
      await plugin.run({ sock, from, msg: msgObj, sender, pushName, args, text: args.join(' '), pluginCount: plugins.length, plugins, config, isOwner, isMod, isGroup, reply: (t) => sock.sendMessage(from, { text: t, mentions:[sender] }) });
    } catch (e) {
      console.log(`[CMD ERR] ${plugin.name}:`, e);
      await sock.sendMessage(from, { text: `❌ Error in .${plugin.name}: ${e.message}`, mentions:[sender] });
    }
  });
  isStarting = false;
  return sock;
}

// ===== PAIR - YOUR METHOD + RETRY FIX =====
app.post("/pair", async (req, res) => {
  try {
    if (!sock) await startBot();
    await new Promise(r => setTimeout(r, 2000));
    const number = (req.body.number || req.body.phone || "").replace(/[^0-9]/g, "");
    if (!number) return res.json({ error: "Enter number" });
    // Retry 3 times - fixes Connection Closed
    let code = null, lastErr = null;
    for (let i = 1; i <= 3; i++) {
      try { code = await sock.requestPairingCode(number); break; }
      catch (e) {
        lastErr = e;
        console.log(`[PAIR RETRY ${i}/3] ${e.message}`);
        if (e.message.includes('Connection Closed') || e.message.includes('closed')) {
          sock = null; isStarting = false;
          await startBot();
          await new Promise(r => setTimeout(r, 4000));
        } else break;
      }
    }
    if (!code) throw lastErr || new Error('Failed to get code');
    console.log(`[PAIR] ${number} -> ${code}`);
    res.json({ code });
  } catch (e) { res.json({ error: e.message }); }
});

// GET version for Pair Page (your frontend uses fetch /pair-code?phone=)
app.get("/pair-code", async (req, res) => {
  try {
    if (!sock) await startBot();
    await new Promise(r => setTimeout(r, 2000));
    const number = (req.query.phone || "").replace(/[^0-9]/g, "");
    if (!number) return res.json({ success: false, error: "Enter number" });
    if (sockState === 'open') return res.json({ success: false, error: "Bot already connected!" });
    let code = null, lastErr = null;
    for (let i = 1; i <= 3; i++) {
      try { code = await sock.requestPairingCode(number); break; }
      catch (e) {
        lastErr = e;
        console.log(`[PAIR RETRY ${i}/3] ${e.message}`);
        if (e.message.includes('Connection Closed') || e.message.includes('closed')) {
          sock = null; isStarting = false;
          await startBot();
          await new Promise(r => setTimeout(r, 4000));
        } else break;
      }
    }
    if (!code) throw lastErr || new Error('Failed to get code');
    console.log(`[PAIR VIA URL] ${number} -> ${code}`);
    res.json({ success: true, code });
  } catch (e) { console.log('[PAIR ERROR]', e.message); res.json({ success: false, error: e.message + ' - Wait 10s and click Generate again' }); }
});

app.get("/api/status", (req, res) => {
  res.json({ online: true, botName: config.botName, connected: sockState === 'open', state: sockState, plugins: plugins.length, uptime: formatUptime(process.uptime()*1000) });
});

app.get("/pair", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on " + PORT));
startBot();
