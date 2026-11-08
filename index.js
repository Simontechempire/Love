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
app.get('/api/status', (req, res) => {
  res.json({ online: true, botName: config.botName, uptime: formatUptime(process.uptime()*1000), plugins: plugins.length, memory: (process.memoryUsage().heapUsed/1024/1024).toFixed(0)+' MB' });
});

// ===== PAIR VIA URL - https://your-render-url.onrender.com/pair =====
let lastPairCode = null;
let lastPairPhone = null;
app.get('/pair', (req, res) => {
  res.send(`
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>LOVE Pair</title>
  <style>body{background:#0f0f0f;color:#fff;font-family:sans-serif;text-align:center;padding:30px} .card{background:#1a1a1a;border:2px solid #ff2e63;border-radius:20px;padding:24px;max-width:400px;margin:auto} input{width:100%;padding:14px;border-radius:10px;border:none;margin:10px 0;font-size:16px} button{background:#ff2e63;color:#fff;border:none;padding:14px;width:100%;border-radius:10px;font-weight:700;font-size:16px} code{font-size:28px;letter-spacing:5px;color:#ff2e63;font-weight:800}</style>
  </head><body><div class="card">
  <h2>◈ <span style="color:#ff2e63">LOVE</span> ◈ Pair</h2>
  <p>Enter your WhatsApp number to get pairing code</p>
  <form action="/pair-code" method="get">
    <input name="phone" placeholder="2348071569915" value="${lastPairPhone||'2348071569915'}" required />
    <button type="submit">Get Pairing Code</button>
  </form>
  ${lastPairCode ? `<p style="margin-top:20px">Your Code:<br><code>${lastPairCode}</code><br><br><small>WhatsApp > Linked Devices > Link with phone number > Enter this code<br>Code expires in 20s - refresh if e fail</small></p>` : `<p style="color:#aaa;font-size:13px;margin-top:16px">Code will show here after you submit</p>`}
  <p style="margin-top:20px"><a href="/" style="color:#ff2e63">← Back to Dashboard</a></p>
  </div></body></html>`);
});
app.get('/pair-code', async (req, res) => {
  const phone = (req.query.phone||'').replace(/[^0-9]/g,'');
  if(!phone) return res.redirect('/pair');
  try{
    lastPairPhone = phone;
    lastPairCode = await globalThis.__loveSock.requestPairingCode(phone);
    console.log(`[PAIR VIA URL] ${phone} -> ${lastPairCode}`);
  }catch(e){ lastPairCode = 'ERROR: '+e.message; }
  res.redirect('/pair');
});

// ===== HELPERS =====
function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }
function readJson(file, def){ try{ if(fs.existsSync(file)) return JSON.parse(fs.readFileSync(file)); }catch{} return def; }
function writeJson(file, data){ ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data,null,2)); }

// Normalize: remove stylized unicode -> plain (ᴍᴇɴᴜ -> menu)
function normalize(str){
  if(!str) return '';
  // Map small-caps / stylized chars to normal
  const map = { 'ᴀ':'a','ʙ':'b','ᴄ':'c','ᴅ':'d','ᴇ':'e','ꜰ':'f','ɢ':'g','ʜ':'h','ɪ':'i','ᴊ':'j','ᴋ':'k','ʟ':'l','ᴍ':'m','ɴ':'n','ᴏ':'o','ᴘ':'p','ǫ':'q','ʀ':'r','ꜱ':'s','ᴛ':'t','ᴜ':'u','ᴠ':'v','ᴡ':'w','x':'x','ʏ':'y','ᴢ':'z','-':'-','_':'_' };
  let out = '';
  for(const ch of str.toLowerCase()) out += map[ch] || ch;
  return out.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

// ===== LOAD PLUGINS - FIXED FOR ARRAYS =====
function loadPlugins() {
  const plugins = [];
  const dir = path.join(__dirname, 'Plugins');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      delete require.cache[require.resolve(path.join(dir, file))];
      const mod = require(path.join(dir, file));
      // Support: module.exports = [ ... ] OR single {name,run} OR {default:[...]}
      const list = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : mod?.name ? [mod] : [];
      for(const p of list){
        if(p?.name && typeof p.run === 'function') plugins.push(p);
        else console.log(`[PLUGIN SKIP] ${file} - bad plugin`, p?.name);
      }
    } catch (e) { console.log(`[PLUGIN ERROR] ${file}:`, e.message); }
  }
  console.log(`[LOVE] Loaded ${plugins.length} plugins from ${files.length} files`);
  return plugins;
}
let plugins = loadPlugins();

// Hot reload plugins every 60s - so .plugin / .remove works without restart
setInterval(()=>{ plugins = loadPlugins(); }, 60000);

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

    // ===== DOWNLOAD HELPER =====
  const { downloadMediaMessage } = require('./Lib/function');
  sock.downloadMediaMessage = (m) => downloadMediaMessage(sock, m);

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
      // Only send startup msg if enabled in Lib/data/config.json
      const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
      if(cfg.startupmsg === 'on'){
        try {
          await sock.sendMessage(config.ownerNumber + '@s.whatsapp.net', {
            image: { url: config.botPic },
            caption: `◈┈▉ *Love* ▉┄◈\n\n✅ *LOVE is Online!*\n\n> ➠ *Owner:* ${config.ownerName}\n> ➠ *Uptime:* ${formatUptime(process.uptime() * 1000)}\n> ➠ *Plugins:* ${plugins.length}\n> ➠ *Prefix:* ${config.prefix}\n\nType *${config.prefix}menu* to see commands.`
          });
        } catch {}
      }
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) startLove();
      else console.log('[LOVE] Logged out - Delete auth_love & re-pair');
    }
  });

  // ===== ANTI-DELETE / ANTI-EDIT (message.update) =====
  sock.ev.on('messages.update', async (updates) => {
    const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
    if(cfg.antidelete !== 'on' && cfg.antiedit !== 'on') return;
    for(const u of updates){
      if(u.update?.message === null && cfg.antidelete === 'on'){
        console.log('[ANTIDELETE] Message deleted:', u.key);
        // Note: Baileys no fit recover deleted content without store - log only
      }
    }
  });

  // ===== MAIN HANDLER =====
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if(type !== 'notify') return;
    const msgRaw = messages[0];
    if (!msgRaw.message || msgRaw.key.fromMe) return;
    const from = msgRaw.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? (msgRaw.key.participant || msgRaw.participant) : from;
    const pushName = msgRaw.pushName || 'User';

    // --- Build normalized msg object plugins expect ---
    const m = msgRaw.message;
    const mtype = Object.keys(m)[0];
    const content = m[mtype];
    const body = m.conversation || content?.text || content?.caption || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
    const quotedMsg = content?.contextInfo?.quotedMessage;
    const quoted = quotedMsg ? {
      key: { remoteJid: from, id: content?.contextInfo?.stanzaId, participant: content?.contextInfo?.participant },
      message: quotedMsg,
      mtype: Object.keys(quotedMsg)[0],
      text: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '',
      caption: quotedMsg.imageMessage?.caption || quotedMsg.videoMessage?.caption || '',
      sender: content?.contextInfo?.participant,
    } : null;
    const msg = {
      ...msgRaw,
      mtype, text: body, body,
      sender, from, pushName,
      mentionedJid: content?.contextInfo?.mentionedJid || [],
      quoted,
      // For downloadMediaMessage(quoted) to work, quoted needs .message
      // download helper handles both
    };
    // Fix quoted for download: attach message
    if(quoted) quoted.message = quotedMsg;

    // --- XP System (for .level/.rank/.xp) ---
    try{
      const usersFile = path.join(__dirname,'Lib/data/users.json');
      const users = readJson(usersFile, {});
      users[sender] = users[sender] || { xp:0, msgs:0 };
      users[sender].xp += 5; users[sender].msgs += 1;
      writeJson(usersFile, users);
    }catch{}

    // --- Load runtime config + bans/mutes ---
    const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
    const banFile = path.join(__dirname,'Lib/data/ban.json');
    const bans = readJson(banFile, { users:[], groups:[] });
    const isOwner = sender.split('@')[0] === config.ownerNumber || (cfg.sudo||[]).includes(sender) || config.ownerNumbers.includes(sender.split('@')[0]);
    const isMod = (cfg.mods||[]).includes(sender);

    // Mode check: private = only owner/sudo
    if(cfg.mode === 'private' && !isOwner && !isMod) return;
    if(cfg.mode === 'self' && !isOwner) return;

    // Ban check
    if(bans.users.includes(sender) && !isOwner) return;
    if(isGroup && bans.groups.includes(from) && !isOwner) return;

    // --- Auto-Read / Always Online ---
    if(cfg.readmsg === 'on' || config.autoRead) { try{ await sock.readMessages([msgRaw.key]); }catch{} }
    if(cfg.alwaysonline === 'on' || config.alwaysOnline) { try{ await sock.sendPresenceUpdate('available', from); }catch{} }

    // --- Group Settings: antilink / antiword / antitag / antispam / antibot ---
    if(isGroup && !isOwner){
      const gSettings = readJson(path.join(__dirname,'Lib/data/group-settings.json'), {})[from] || {};
      // Check if sender is admin - admins bypass
      let senderIsAdmin = false;
      try{ const meta = await sock.groupMetadata(from); senderIsAdmin = !!meta.participants.find(p=>p.id===sender)?.admin; }catch{}
      if(!senderIsAdmin){
        // Antilink
        if(gSettings.antilink === 'on' && /https?:\/\/|chat\.whatsapp\.com|wa\.me\//i.test(body)){
          try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
          await sock.sendMessage(from,{text:`🚫 @${sender.split('@')[0]} - Links not allowed!`, mentions:[sender]});
          if(gSettings.akick === 'on'){ try{ await sock.groupParticipantsUpdate(from,[sender],'remove'); }catch{} }
          return;
        }
        // Antiword
        if(gSettings.antiword === 'on' && (gSettings.antiwords||[]).some(w=> body.toLowerCase().includes(w.toLowerCase()))){
          try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
          await sock.sendMessage(from,{text:`🚫 @${sender.split('@')[0]} - Bad word!`, mentions:[sender]});
          return;
        }
        // Antitag - too many mentions
        if(gSettings.antitag === 'on' && (msg.mentionedJid.length > 5)){
          try{ await sock.sendMessage(from,{delete: msgRaw.key}); }catch{}
          await sock.sendMessage(from,{text:`🚫 Mass tag not allowed!`, mentions:[sender]});
          return;
        }
      }
    }

    // --- AFK check ---
    try{
      const afk = readJson(path.join(__dirname,'Lib/data/afk.json'), {});
      for(const jid of msg.mentionedJid){
        if(afk[jid]) await sock.sendMessage(from,{text:`😴 @${jid.split('@')[0]} is AFK: ${afk[jid].reason}`, mentions:[jid]});
      }
      if(afk[sender]){ delete afk[sender]; writeJson(path.join(__dirname,'Lib/data/afk.json'), afk); await sock.sendMessage(from,{text:`👋 Welcome back @${sender.split('@')[0]}! You are no longer AFK.`, mentions:[sender]}); }
    }catch{}

    // --- Autoreply / Filters ---
    try{
      const filters = readJson(path.join(__dirname,'Lib/data/filters.json'), {personal:{},group:{}});
      const lower = body.toLowerCase().trim();
      if(isGroup && filters.group?.[from]?.[lower]){
        await sock.sendMessage(from,{text: filters.group[from][lower], mentions:[sender]});
        return;
      }
      if(!isGroup && filters.personal?.[lower]){
        await sock.sendMessage(from,{text: filters.personal[lower], mentions:[sender]});
        return;
      }
    }catch{}

    // --- Custom Cmds (.setcmd) ---
    if(body.startsWith(config.prefix)){
      const custom = readJson(path.join(__dirname,'Lib/data/custom-cmds.json'), {});
      const customName = body.slice(config.prefix.length).trim().split(/ +/)[0].toLowerCase();
      if(custom[customName]){
        await sock.sendMessage(from,{text: custom[customName], mentions:[sender]});
        return;
      }
    }

    // --- Command handling ---
    if (!body.startsWith(config.prefix)) return;
    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const cmdNameRaw = args.shift() || '';
    const cmdName = normalize(cmdNameRaw);

    // Find plugin by name OR alias (both normalized)
    const plugin = plugins.find(p => normalize(p.name) === cmdName || (p.alias||[]).some(a => normalize(a) === cmdName));
    if (!plugin) return;

    // Mute-user check (from bot.js .mute-user)
    const muted = readJson(path.join(__dirname,'Lib/data/muted.json'), []);
    if(muted.includes(sender) && !isOwner) { await sock.sendMessage(from,{text:`🔇 You are muted from using bot.`, mentions:[sender]}); return; }

    // Cmd React
    if(cfg.cmdreact === 'on'){ try{ await sock.sendMessage(from,{react:{text:'❤️', key: msgRaw.key}}); }catch{} }

    try {
      await plugin.run({
        sock, from, msg, sender, pushName, args,
        text: args.join(' '),
        pluginCount: plugins.length,
        plugins, // for .menu / .plugins / .plugin
        config, isOwner, isMod, isGroup,
        // Helpers plugins use
        reply: (t) => sock.sendMessage(from, { text: t, mentions:[sender] }),
      });
    } catch (e) {
      console.log(`[CMD ERR] ${plugin.name}:`, e);
      await sock.sendMessage(from, { text: `❌ Error in .${plugin.name}: ${e.message}`, mentions:[sender] });
    }
  });

  // ===== Status handling (readstatus / likestatus / savestatus) =====
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

  // ===== Reject Call =====
  sock.ev.on('call', async (calls) => {
    const cfg = readJson(path.join(__dirname,'Lib/data/config.json'), {});
    if(cfg.rejectcall !== 'on') return;
    for(const c of calls){
      if(c.status === 'offer'){
        try{ await sock.rejectCall(c.id, c.from); }catch{}
      }
    }
  });
}
startLove();
