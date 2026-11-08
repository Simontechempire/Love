const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const config = require("./config");

let gcStatus = null;
try { gcStatus = require("./gcstatus"); } catch { console.log("[WARN] gcstatus.js not found, skip"); }

// ===== HELPERS =====
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

// ===== UNIVERSAL PLUGIN LOADER - LOADS ALL FORMATS =====
function getPluginDir(){
  const cands = [path.join(__dirname,'Plugins'), path.join(__dirname,'plugins'), path.join(__dirname,'Plugin'), path.join(__dirname,'commands')];
  for(const c of cands) if(fs.existsSync(c)) return c;
  return cands[0];
}
function loadPlugins(){
  const dir = getPluginDir();
  const commandPlugins = []; // {name, alias, run, file, raw}
  const messageHandlers = []; // functions that handle EVERY message: (ctx) => {}
  const eventHandlers = []; // {event, handler}
  if(!fs.existsSync(dir)){ console.log('[LOVE] No Plugins folder found:', dir); return {commandPlugins, messageHandlers, eventHandlers, files:[]}; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for(const file of files){
    const full = path.join(dir, file);
    try{
      delete require.cache[require.resolve(full)];
      let mod = require(full);
      if(mod && mod.default) mod = mod.default;
      const items = Array.isArray(mod) ? mod : [mod];
      for(const item of items){
        if(!item) continue;
        // FORMAT 1: function(sock, msg) or function(ctx) - handles every message
        if(typeof item === 'function'){
          // If function expects sock only and returns nothing, it may be a register function - store as register
          // We treat it as message handler, try both
          messageHandlers.push({ file, fn: item });
          console.log(`[LOVE] Loaded message-handler: ${file}`);
          continue;
        }
        if(typeof item !== 'object') continue;
        // FORMAT 2: { name, run } / { name, execute } / { name, handler } / { name, callback }
        const name = item.name || item.command || item.cmd || item.pattern;
        const runFn = item.run || item.execute || item.handler || item.callback || item.action;
        if(name && typeof runFn === 'function'){
          const alias = item.alias || item.aliases || item.commands || [];
          commandPlugins.push({ name: String(name), alias: Array.isArray(alias)?alias:[alias].filter(Boolean), run: runFn, file, raw: item, prefix: item.prefix, category: item.category || item.type || 'general', desc: item.desc || item.description || '' });
          console.log(`[LOVE] Loaded command: .${name} (${file})`);
          continue;
        }
        // FORMAT 3: { onMessage / onMsg / message } - handles every message
        const onMsg = item.onMessage || item.onMsg || item.message || item.handleMessage;
        if(typeof onMsg === 'function'){
          messageHandlers.push({ file, fn: onMsg, raw: item });
          console.log(`[LOVE] Loaded onMessage: ${file}`);
          continue;
        }
        // FORMAT 4: { event, handler } - e.g. group participant update
        if(item.event && typeof (item.handler || item.run) === 'function'){
          eventHandlers.push({ event: item.event, handler: item.handler || item.run, file });
          console.log(`[LOVE] Loaded event: ${item.event} (${file})`);
          continue;
        }
        // FORMAT 5: { commands: [{name, run}] } - nested
        if(Array.isArray(item.commands)){
          for(const c of item.commands){
            if(c?.name && typeof (c.run||c.execute)==='function'){
              commandPlugins.push({ name: c.name, alias: c.alias||c.aliases||[], run: c.run||c.execute, file, raw: c });
              console.log(`[LOVE] Loaded nested command: .${c.name} (${file})`);
            }
          }
          continue;
        }
        // FORMAT 6: Object of functions { ping: fn, menu: fn }
        const keys = Object.keys(item);
        let loaded = 0;
        for(const k of keys){
          if(typeof item[k] === 'function' && !['run','execute'].includes(k)){
            commandPlugins.push({ name: k, alias: [], run: item[k], file, raw: item });
            console.log(`[LOVE] Loaded object-command: .${k} (${file})`);
            loaded++;
          }
        }
        if(loaded===0) console.log(`[LOVE] ⚠️ Skipped (no name/run found): ${file} keys=${keys.join(',')}`);
      }
    }catch(e){ console.log(`[PLUGIN ERROR] ${file}:`, e.message); }
  }
  console.log(`[LOVE] Total: ${commandPlugins.length} commands + ${messageHandlers.length} message-handlers + ${eventHandlers.length} event-handlers from ${files.length} files`);
  return { commandPlugins, messageHandlers, eventHandlers, files };
}
let PLUGINS = loadPlugins();
setInterval(()=>{ PLUGINS = loadPlugins(); }, 60000);

let getBuffer, formatUptime;
try { ({ getBuffer, formatUptime } = require('./Lib/function')); } catch { try { ({ getBuffer, formatUptime } = require('./lib/function')); } catch { getBuffer = async()=>null; formatUptime = (ms)=> Math.floor(ms/1000)+'s'; } }

// ===== EXPRESS - Public case-proof =====
const app = express();
app.use(express.json());
let publicDir = path.join(__dirname, "Public");
if (!fs.existsSync(publicDir)) publicDir = path.join(__dirname, "public");
console.log("[LOVE] Public dir:", publicDir, "exists:", fs.existsSync(publicDir));
if (fs.existsSync(publicDir)) console.log("[LOVE] Files in Public:", fs.readdirSync(publicDir));
app.use(express.static(publicDir));

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
      if (code === 401 || !re) {
        try { fs.rmSync(path.join(__dirname, config.sessionFolder || "session"), { recursive: true, force: true }); console.log('[LOVE] Cleared bad session'); } catch {}
      }
      if (re || code === 401) setTimeout(()=>startBot(), 5000);
    }
  });

  // Attach event handlers from plugins
  for(const ev of PLUGINS.eventHandlers){
    try{ sock.ev.on(ev.event, (data)=> ev.handler({sock, data, config})); }catch(e){ console.log('[EVENT ERR]', e.message); }
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;
    const m = msg.message;
    const mtype = Object.keys(m)[0];
    const content = m[mtype];
    const body = m.conversation || content?.text || content?.caption || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || "";
    const text = body.toLowerCase().trim();

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

    // Build full ctx ONCE - all plugins use this
    const quotedMsg = content?.contextInfo?.quotedMessage;
    const quoted = quotedMsg ? { key: { remoteJid: from, id: content?.contextInfo?.stanzaId, participant: content?.contextInfo?.participant }, message: quotedMsg, mtype: Object.keys(quotedMsg)[0], text: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', caption: quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', sender: content?.contextInfo?.participant } : null;
    const msgObj = { ...msg, mtype, text: body, body, sender, from, pushName, mentionedJid: content?.contextInfo?.mentionedJid || [], quoted, isGroup, isOwner: false };
    const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
    const isOwner = sender.split('@')[0] === String(config.ownerNumber) || (cfg.sudo||[]).includes(sender) || (config.ownerNumbers||[]).includes(sender.split('@')[0]);
    const isMod = (cfg.mods||[]).includes(sender);
    msgObj.isOwner = isOwner;
    if(cfg.mode === 'private' && !isOwner && !isMod) return;
    if(cfg.mode === 'self' && !isOwner) return;

    const reply = (t, opts={}) => sock.sendMessage(from, { text: t, mentions:[sender], ...opts });
    const ctx = { sock, from, msg: msgObj, sender, pushName, args: [], text: body, pluginCount: PLUGINS.commandPlugins.length, plugins: PLUGINS.commandPlugins, config, isOwner, isMod, isGroup, reply, getBuffer, formatUptime, quoted, mentionedJid: msgObj.mentionedJid };

    // ===== 1. MESSAGE HANDLERS - run for EVERY message (auto-reply, anti-link, welcome, etc) =====
    for(const h of PLUGINS.messageHandlers){
      try{
        // Try different signatures - plugin go use wetin e need
        await h.fn(ctx);
        // Also try (sock, msgObj) signature if plugin expects that
        if(h.fn.length >= 2) await h.fn(sock, msgObj);
      }catch(e){ console.log(`[HANDLER ERR] ${h.file}:`, e.message); }
    }

    // ===== 2. COMMAND PLUGINS - only if body starts with prefix =====
    if (!body.startsWith(config.prefix)) return;
    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const cmdName = normalize(args.shift() || '');
    if(!cmdName) return;
    const plugin = PLUGINS.commandPlugins.find(p => normalize(p.name) === cmdName || (p.alias||[]).some(a => normalize(a) === cmdName));
    if (!plugin){
      console.log(`[LOVE] No plugin for .${cmdName} - available: ${PLUGINS.commandPlugins.map(p=>p.name).join(', ')}`);
      return;
    }
    ctx.args = args;
    ctx.text = args.join(' ');
    ctx.command = cmdName;
    console.log(`[LOVE] Running .${plugin.name} from ${pushName} (${plugin.file})`);
    try {
      await plugin.run(ctx);
    } catch (e) {
      console.log(`[CMD ERR] ${plugin.name}:`, e);
      await sock.sendMessage(from, { text: `❌ Error in .${plugin.name}: ${e.message}`, mentions:[sender] });
    }
  });
  isStarting = false;
  return sock;
}

app.post("/pair", async (req, res) => {
  try {
    if (!sock) await startBot();
    await new Promise(r => setTimeout(r, 2000));
    const number = (req.body.number || req.body.phone || "").replace(/[^0-9]/g, "");
    if (!number) return res.json({ error: "Enter number" });
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
  res.json({ online: true, botName: config.botName, connected: sockState === 'open', state: sockState, plugins: PLUGINS.commandPlugins.length, handlers: PLUGINS.messageHandlers.length, uptime: formatUptime(process.uptime()*1000), commands: PLUGINS.commandPlugins.map(p=>p.name) });
});

app.get("/api/plugins", (req, res) => {
  res.json({ commands: PLUGINS.commandPlugins.map(p=>({name:p.name, file:p.file, alias:p.alias})), handlers: PLUGINS.messageHandlers.map(h=>h.file), total: PLUGINS.commandPlugins.length });
});

app.get("/pair", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/", (req, res) => {
  const file = path.join(publicDir, "index.html");
  if (!fs.existsSync(file)) return res.send(`<h2>LOVE Pair</h2><p>index.html not found in ${publicDir}</p>`);
  res.sendFile(file);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server on " + PORT));
startBot();
