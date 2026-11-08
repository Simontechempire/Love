const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('alip-baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// ===== Lib/function - case-proof + fallback =====
let getBuffer, formatUptime, downloadMediaMessage;
try {
  ({ getBuffer, formatUptime, downloadMediaMessage } = require('./Lib/function'));
} catch (e1) {
  try {
    ({ getBuffer, formatUptime, downloadMediaMessage } = require('./lib/function'));
  } catch (e2) {
    console.log('[WARN] Lib/function.js not found - using fallback');
    const axios = require('axios');
    getBuffer = async (url) => { try { const r = await axios.get(url, { responseType: 'arraybuffer' }); return Buffer.from(r.data); } catch { return null; } };
    formatUptime = (ms) => { let s = Math.floor(ms / 1000); let d = Math.floor(s / 86400); let h = Math.floor((s % 86400) / 3600); let m = Math.floor((s % 3600) / 60); return d > 0 ? `${d}d ${h}h ${m}m ${s % 60}s` : `${h}h ${m}m ${s % 60}s`; };
    downloadMediaMessage = async () => null;
  }
}

const app = express();
const PORT = process.env.PORT || config.port || 3000;

// ===== Public folder - case-proof =====
let publicDir = path.join(__dirname, 'Public');
if (!fs.existsSync(publicDir)) publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

let plugins = [];

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===== LOAD PLUGINS =====
function loadPlugins() {
  const list = [];
  let dir = path.join(__dirname, 'Plugins');
  if (!fs.existsSync(dir) && fs.existsSync(path.join(__dirname, 'plugins'))) dir = path.join(__dirname, 'plugins');
  if (!fs.existsSync(dir)) { console.log('[LOVE] Plugins folder not found'); return list; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(dir, file))];
      const mod = require(path.join(dir, file));
      const arr = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : mod?.name ? [mod] : [];
      for(const p of arr){ if(p?.name && typeof p.run === 'function') list.push(p); }
    } catch (e) { console.log(`[PLUGIN ERROR] ${file}:`, e.message); }
  }
  console.log(`[LOVE] Loaded ${list.length} plugins from ${files.length} files`);
  return list;
}
plugins = loadPlugins();
setInterval(()=>{ plugins = loadPlugins(); }, 60000);

// ===== RENDER URL = PAIR PAGE ONLY =====
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/pair', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/api/status', (req, res) => {
  res.json({ online: true, botName: config.botName, connected: !!globalThis.__loveConnected, state: globalThis.__loveState || 'starting', uptime: formatUptime(process.uptime()*1000), plugins: plugins.length });
});

let lastPairCode = null;
let lastPairPhone = null;
let lastPairError = null;
let lastPairTime = 0;

// ===== PAIR-CODE WITH RETRY - FIXES Connection Closed =====
app.get('/pair-code', async (req, res) => {
  const phone = (req.query.phone||'').replace(/[^0-9]/g,'');
  if(!phone) return res.json({ success: false, error: 'Enter phone number' });
  lastPairPhone = phone; lastPairCode = null; lastPairError = null;
  try{
    if(globalThis.__loveConnected) throw new Error('Bot already connected! No need to pair again.');
    if(!globalThis.__loveSock) throw new Error('Bot starting... wait 10 seconds and try again');

    // If sock closed, restart am and wait
    if(globalThis.__loveState === 'close' || globalThis.__loveState === 'closed'){
      console.log('[PAIR] Sock closed, restarting...');
      startLove();
      await sleep(5000);
    }

    // Try 3 times - fixes Connection Closed
    let code = null, lastErr = null;
    for(let i=1; i<=3; i++){
      try{
        code = await globalThis.__loveSock.requestPairingCode(phone);
        break;
      }catch(e){
        lastErr = e;
        console.log(`[PAIR RETRY ${i}/3] ${e.message}`);
        if(e.message.includes('Connection Closed') || e.message.includes('closed')){
          await sleep(3000);
          if(globalThis.__loveState === 'close'){ startLove(); await sleep(5000); }
        } else break;
      }
    }
    if(!code) throw lastErr || new Error('Failed to get code');

    lastPairCode = code; lastPairTime = Date.now();
    console.log(`[PAIR VIA URL] ${phone} -> ${code}`);
    return res.json({ success: true, code: code, phone: phone });
  }catch(e){
    lastPairError = e.message;
    console.log('[PAIR ERROR]', e.message);
    return res.json({ success: false, error: e.message + ' - Wait 10s and click Generate again' });
  }
});

app.get('/api/pair-status', (req, res) => {
  res.json({ connected: !!globalThis.__loveConnected, state: globalThis.__loveState, code: lastPairCode, phone: lastPairPhone, error: lastPairError });
});

app.listen(PORT, () => console.log(`[LOVE] Web on ${PORT} - Pair URL: /`));

// ===== START LOVE - WITH GUARD =====
let isStarting = false;
async function startLove() {
  if(isStarting) { console.log('[LOVE] Already starting, skip duplicate'); return; }
  isStarting = true;
  try{
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version, auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Love', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });
    globalThis.__loveSock = sock;
    globalThis.__loveConnected = false;
    globalThis.__loveState = 'connecting';
    isStarting = false;
    sock.ev.on('creds.update', saveCreds);
    if (downloadMediaMessage) sock.downloadMediaMessage = (m) => downloadMediaMessage(sock, m);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      globalThis.__loveState = connection || globalThis.__loveState;
      console.log('[CONN]', connection, lastDisconnect?.error?.output?.statusCode || '');
      if (connection === 'connecting') { globalThis.__loveState = 'connecting'; return; }
      if (connection === 'open') {
        globalThis.__loveConnected = true;
        lastPairCode = null;
        console.log('[LOVE] Connected ✅');
        try { const pic = await getBuffer(config.botPic); if (pic) await sock.updateProfilePicture(sock.user.id, pic); } catch {}
        try { await sock.updateProfileStatus(`💖 ${config.botName} Bot | Owner: ${config.ownerName} | Prefix: ${config.prefix}menu`); await sock.updateProfileName(config.botName); } catch {}
        const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
        if(cfg.startupmsg === 'on'){
          try { await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', { image: { url: config.botPic }, caption: `◈┈▉ *Love* ▉┄◈\n\n✅ *LOVE is Online!*\n\n> ➠ *Owner:* ${config.ownerName}\n> ➠ *Uptime:* ${formatUptime(process.uptime() * 1000)}\n> ➠ *Plugins:* ${plugins.length}\n> ➠ *Prefix:* ${config.prefix}\n\nType *${config.prefix}menu* to see commands.` }); } catch {}
        }
      }
      if (connection === 'close') {
        globalThis.__loveConnected = false;
        globalThis.__loveState = 'close';
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log('[LOVE] Closed, reason:', reason);
        if (reason === DisconnectReason.loggedOut || reason === 401) {
          console.log('[LOVE] Logged out - clearing bad session');
          try{ fs.rmSync(path.join(__dirname, config.sessionFolder), { recursive: true, force: true }); }catch{}
          setTimeout(()=>startLove(), 5000);
        } else {
          setTimeout(()=>startLove(), 5000);
        }
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
      if(cfg.antidelete !== 'on' && cfg.antiedit !== 'on') return;
      for(const u of updates){ if(u.update?.message === null && cfg.antidelete === 'on') console.log('[ANTIDELETE] Message deleted:', u.key); }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if(type !== 'notify') return;
      const msgRaw = messages[0];
      if (!msgRaw.message || msgRaw.key.fromMe) return;
      const from = msgRaw.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const sender = isGroup ? (msgRaw.key.participant || msgRaw.participant) : from;
      const pushName = msgRaw.pushName || 'User';
      const m = msgRaw.message;
      const mtype = Object.keys(m)[0];
      const content = m[mtype];
      const body = m.conversation || content?.text || content?.caption || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
      const quotedMsg = content?.contextInfo?.quotedMessage;
      const quoted = quotedMsg ? { key: { remoteJid: from, id: content?.contextInfo?.stanzaId, participant: content?.contextInfo?.participant }, message: quotedMsg, mtype: Object.keys(quotedMsg)[0], text: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', caption: quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '', sender: content?.contextInfo?.participant } : null;
      const msg = { ...msgRaw, mtype, text: body, body, sender, from, pushName, mentionedJid: content?.contextInfo?.mentionedJid || [], quoted };
      if(quoted) quoted.message = quotedMsg;
      try{ const usersFile = path.join(__dirname,'Lib/data/users.json'); const users = readJson(usersFile, {}); users[sender] = users[sender] || { xp:0, msgs:0 }; users[sender].xp += 5; users[sender].msgs += 1; writeJson(usersFile, users); }catch{}
      const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
      const bans = readJson(path.join(__dirname,'Lib/data/ban.json'), { users:[], groups:[] });
      const isOwner = sender.split('@')[0] === config.ownerNumber || (cfg.sudo||[]).includes(sender) || (config.ownerNumbers||[]).includes(sender.split('@')[0]);
      const isMod = (cfg.mods||[]).includes(sender);
      if(cfg.mode === 'private' && !isOwner && !isMod) return;
      if(cfg.mode === 'self' && !isOwner) return;
      if(bans.users.includes(sender) && !isOwner) return;
      if(isGroup && bans.groups.includes(from) && !isOwner) return;
      if(cfg.readmsg === 'on' || config.autoRead) { try{ await sock.readMessages([msgRaw.key]); }catch{} }
      if(cfg.alwaysonline === 'on' || config.alwaysOnline) { try{ await sock.sendPresenceUpdate('available', from); }catch{} }
      if(isGroup && !isOwner){
        const gSettings = readJson(path.join(__dirname,'Lib/data/group-settings.json'), {})[from] || {};
        let senderIsAdmin = false;
        try{ const meta = await sock.groupMetadata(from); senderIsAdmin = !!meta.participants.find(p=>p.id===sender)?.admin; }catch{}
        if(!senderIsAdmin){
          if(gSettings.antilink === 'on' && /https?:\/\/|chat\.whatsapp\.com|wa\.me\//i.test(body)){
            try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
            await sock.sendMessage(from,{text:`🚫 @${sender.split('@')[0]} - Links not allowed!`, mentions:[sender]});
            if(gSettings.akick === 'on'){ try{ await sock.groupParticipantsUpdate(from,[sender],'remove'); }catch{} }
            return;
          }
          if(gSettings.antiword === 'on' && (gSettings.antiwords||[]).some(w=> body.toLowerCase().includes(w.toLowerCase()))){
            try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
            await sock.sendMessage(from,{text:`🚫 @${sender.split('@')[0]} - Bad word!`, mentions:[sender]});
            return;
          }
          if(gSettings.antitag === 'on' && (msg.mentionedJid.length > 5)){
            try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
            await sock.sendMessage(from,{text:`🚫 Mass tag not allowed!`, mentions:[sender]});
            return;
          }
        }
      }
      try{
        const afk = readJson(path.join(__dirname,'Lib/data/afk.json'), {});
        for(const jid of msg.mentionedJid){ if(afk[jid]) await sock.sendMessage(from,{text:`😴 @${jid.split('@')[0]} is AFK: ${afk[jid].reason}`, mentions:[jid]}); }
        if(afk[sender]){ delete afk[sender]; writeJson(path.join(__dirname,'Lib/data/afk.json'), afk); await sock.sendMessage(from,{text:`👋 Welcome back @${sender.split('@')[0]}! You are no longer AFK.`, mentions:[sender]}); }
      }catch{}
      try{
        const filters = readJson(path.join(__dirname,'Lib/data/filters.json'), {personal:{},group:{}});
        const lower = body.toLowerCase().trim();
        if(isGroup && filters.group?.[from]?.[lower]){ await sock.sendMessage(from,{text: filters.group[from][lower], mentions:[sender]}); return; }
        if(!isGroup && filters.personal?.[lower]){ await sock.sendMessage(from,{text: filters.personal[lower], mentions:[sender]}); return; }
      }catch{}
      if(body.startsWith(config.prefix)){
        const custom = readJson(path.join(__dirname,'Lib/data/custom-cmds.json'), {});
        const customName = body.slice(config.prefix.length).trim().split(/ +/)[0].toLowerCase();
        if(custom[customName]){ await sock.sendMessage(from,{text: custom[customName], mentions:[sender]}); return; }
      }
      if (!body.startsWith(config.prefix)) return;
      const args = body.slice(config.prefix.length).trim().split(/ +/);
      const cmdNameRaw = args.shift() || '';
      const cmdName = normalize(cmdNameRaw);
      const plugin = plugins.find(p => normalize(p.name) === cmdName || (p.alias||[]).some(a => normalize(a) === cmdName));
      if (!plugin) return;
      const muted = readJson(path.join(__dirname,'Lib/data/muted.json'), []);
      if(muted.includes(sender) && !isOwner) { await sock.sendMessage(from,{text:`🔇 You are muted from using bot.`, mentions:[sender]}); return; }
      if(cfg.cmdreact === 'on'){ try{ await sock.sendMessage(from,{react:{text:'❤️', key: msgRaw.key}}); }catch{} }
      try {
        await plugin.run({ sock, from, msg, sender, pushName, args, text: args.join(' '), pluginCount: plugins.length, plugins, config, isOwner, isMod, isGroup, reply: (t) => sock.sendMessage(from, { text: t, mentions:[sender] }) });
      } catch (e) {
        console.log(`[CMD ERR] ${plugin.name}:`, e);
        await sock.sendMessage(from, { text: `❌ Error in .${plugin.name}: ${e.message}`, mentions:[sender] });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
      if(cfg.readstatus !== 'on' && cfg.likestatus !== 'on' && cfg.savestatus !== 'on') return;
      const m = messages[0];
      if(m?.key?.remoteJid !== 'status@broadcast') return;
      try{
        if(cfg.readstatus === 'on') await sock.readMessages([m.key]);
        if(cfg.likestatus === 'on') await sock.sendMessage('status@broadcast', { react:{ text: cfg.statusEmoji || '❤️', key: m.key } });
        if(cfg.savestatus === 'on') await sock.sendMessage(config.ownerNumber+'@s.whatsapp.net', { forward: m });
      }catch{}
    });

    sock.ev.on('call', async (calls) => {
      const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
      if(cfg.rejectcall !== 'on') return;
      for(const c of calls){ if(c.status === 'offer'){ try{ await sock.rejectCall(c.id, c.from); }catch{} } }
    });
  }catch(e){
    console.log('[START ERROR]', e.message);
    isStarting = false;
    setTimeout(()=>startLove(), 5000);
  }
}
startLove();
