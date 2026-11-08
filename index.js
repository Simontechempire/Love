// META AI MD - INDEX.JS - MATCHES CHANGED FUNCTION - SIMON TECH INC
// lib/menu.js NOT TOUCHED - linking NOT TOUCHED
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const config = require('./config');
const F = require('./lib/function');
const { getMenu, MENU_PFP } = require('./lib/menu');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = config.port || process.env.PORT || 10000;
let sock = null;
let db = F.loadDB() || {};
let isStarting = false;
let reconnectTimer = null;
// CHANGED: loadDB already sets defaults, don't overwrite saved prefix/mode
if (!db.settings) db.settings = {};
if (!db.anti) db.anti = {};
if (!db.group) db.group = {};
if (!db.auto) db.auto = {};
if (!db.warns) db.warns = {};
// Use F.fancy from changed function, fallback if missing
const fancy = F.fancy || F.bold || ((t)=>String(t));
F.fancy = fancy; F.bold = fancy;
function getNums(...jids){
  // Use F.getNums from changed function
  if(F.getNums) return F.getNums(...jids);
  let out=[];
  for(let j of jids){ let n=String(j||'').split('@')[0].split(':')[0].replace(/[^0-9]/g,''); if(n) out.push(n); }
  return [...new Set(out)];
}
function isOwnerCheck(sender, senderPn, database){
  // CHANGED: Use F.isOwnerMessage / F.isOwner from changed function first
  try{
    if(F.isOwner && (F.isOwner(sender, database, senderPn) || F.isOwner(senderPn, database, sender))) return true;
  }catch{}
  let nums = getNums(sender, senderPn);
  if(!nums.length) return false;
  let owners=[];
  if(config.ownerNumber) owners.push(...getNums(config.ownerNumber));
  if(database.owner) owners.push(...getNums(database.owner));
  if(Array.isArray(database.owners)) database.owners.forEach(o=>owners.push(...getNums(o)));
  if(Array.isArray(config.owners)) config.owners.forEach(o=>owners.push(...getNums(o)));
  if(database.settings?.owner) owners.push(...getNums(database.settings.owner));
  return nums.some(n=>owners.includes(n));
}
function getMode(database){
  if(config.forceMode && config.mode) return String(config.mode).toLowerCase()==='private' ? 'private' : 'public';
  const mode = database.settings?.mode || database.mode || config.mode || 'public';
  return String(mode).toLowerCase()==='private' ? 'private' : 'public';
}
function getPrefixes(){
  let p = db.settings?.prefix || config.prefix || '.';
  let list = [];
  if(Array.isArray(config.prefixes)) list.push(...config.prefixes);
  list.push(p);
  if(config.prefix && !list.includes(config.prefix)) list.push(config.prefix);
  return [...new Set(list)];
}
let commands = new Map();
let functionPlugins = [];
let handlerMods = [];
function extractCommands(plugin){
  let list=[];
  if(!plugin) return list;
  if(Array.isArray(plugin)) list.push(...plugin);
  if(Array.isArray(plugin.commands)) list.push(...plugin.commands);
  if(Array.isArray(plugin.plugins)) list.push(...plugin.plugins);
  if(plugin.name && typeof plugin.run==='function') list.push(plugin);
  if(!list.length && typeof plugin==='object'){
    for(let v of Object.values(plugin)){
      if(v && v.name && typeof v.run==='function') list.push(v);
      if(Array.isArray(v)) for(let c of v) if(c?.name && typeof c.run==='function') list.push(c);
    }
  }
  return list;
}
function loadPlugins(){
  commands.clear(); functionPlugins=[]; handlerMods=[];
  const dir = path.join(__dirname, 'plugins');
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.js')).sort();
  for(const file of files){
    try{
      const fullPath = path.join(dir, file);
      delete require.cache[require.resolve(fullPath)];
      let plugin = require(fullPath);
      if(plugin?.default) plugin = plugin.default;
      let handlers = {};
      let src = plugin || {};
      let handlerSrc = src.handlers || src;
      for(let k of ['handleAnti','handleAuto','handleProtection','handleParticipantProtection','handleMuted','handleStatus','handleParticipants','handleDelete','startAutoBio']){
        if(typeof handlerSrc?.[k]==='function') handlers[k]=handlerSrc[k];
        if(typeof src?.[k]==='function') handlers[k]=src[k];
      }
      if(Object.keys(handlers).length) handlerMods.push({ file, handlers });
      if(typeof plugin==='function'){ functionPlugins.push({file, fn:plugin}); console.log(`✅ Loaded ${file}: function plugin`); continue; }
      if(plugin && typeof plugin.handler==='function'){ functionPlugins.push({file, fn:plugin.handler}); }
      let list = extractCommands(plugin);
      let added=0;
      for(const command of list){
        if(!command?.name || typeof command.run!=='function') continue;
        let name=command.name.toLowerCase();
        if(commands.has(name)){ console.log(`⚠️ Duplicate ${name} in ${file} - skipping`); continue; }
        commands.set(name, command); added++;
        if(Array.isArray(command.aliases)){
          for(let alias of command.aliases){
            let a=String(alias).toLowerCase();
            if(!commands.has(a)) commands.set(a, command);
          }
        }
      }
      console.log(`✅ Loaded ${file}: ${added} commands`);
    }catch(e){ console.log(`❌ Plugin error ${file}:`, e.message); }
  }
  console.log(`📦 Commands loaded: ${commands.size}`);
  console.log(`⚙️ Function plugins: ${functionPlugins.length} | Handler mods: ${handlerMods.length}`);
}
loadPlugins();
function getHandler(name){
  let out=[];
  for(let m of handlerMods) if(m.handlers[name]) out.push(m.handlers[name]);
  return out;
}
app.get('/ping',(req,res)=>res.send('pong'));
app.get('/status',(req,res)=>res.json({connected:Boolean(sock?.user), user:sock?.user?.id||null, commands:commands.size, mode:getMode(db)}));
app.get('/pair', async (req,res)=>{
  try{
    const number=String(req.query.number||'').replace(/[^0-9]/g,'');
    if(!number || number.length<9) return res.status(400).json({error:'Invalid phone number'});
    if(!sock) return res.status(503).json({error:'Bot is starting. Try again shortly.'});
    if(sock.user) return res.status(409).json({error:'This bot session is already connected.'});
    const code=await sock.requestPairingCode(number);
    return res.json({code});
  }catch(e){ console.log('Pairing error:', e.message); return res.status(500).json({error:'Pairing failed. Try again.'}); }
});
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`🌐 Server running on port ${PORT}`));
setInterval(async()=>{ try{ const url=process.env.RENDER_EXTERNAL_URL||`http://localhost:${PORT}`; await fetch(`${url}/ping`); }catch{} }, 4*60*1000);
async function getGroupPermissions(from, sender, senderPn){
  try{
    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants||[];
    const sNums = getNums(sender, senderPn);
    const bNums = getNums(sock?.user?.id, sock?.user?.lid, sock?.user?.pn);
    const findByNums = (nums) => participants.find(p=>{
      const pNums = getNums(p.id, p.phoneNumber, p.lid);
      return nums.some(n=> pNums.includes(n)) || pNums.some(n=> nums.includes(n));
    });
    let participant = findByNums(sNums);
    let bot = findByNums(bNums);
    if(!participant && F.findParticipant) participant = F.findParticipant(metadata, sender) || F.findParticipant(metadata, senderPn);
    if(!bot && F.findParticipant) bot = F.findParticipant(metadata, sock?.user?.id) || F.findParticipant(metadata, sock?.user?.lid);
    const isAdmin = ['admin','superadmin'].includes(participant?.admin);
    const isBotAdmin = ['admin','superadmin'].includes(bot?.admin);
    return { isAdmin, isBotAdmin, metadata, participant, bot };
  }catch(e){ return {isAdmin:false,isBotAdmin:false,metadata:null}; }
}
async function builtInAntiLink(sock, m, from, sender, senderPn, body, perms, isOwner){
  if(!isOwner && perms.isAdmin) return false;
  const anti = db.anti?.[from] || db.group?.[from];
  const on = anti?.antilink || anti?.antiLink || anti?.antilinkEnabled;
  if(!on) return false;
  const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|t\.me\/|telegram\.me\/|discord\.gg\/|instagram\.com\/|youtube\.com\/|youtu\.be\/)/i;
  if(!linkRegex.test(body)) return false;
  await sock.sendMessage(from, { delete: m.key }).catch(()=>{});
  if(!db.warns[from]) db.warns[from] = {};
  const key = sender;
  db.warns[from][key] = (db.warns[from][key]||0) + 1;
  const count = db.warns[from][key];
  F.saveDB(db);
  if(count >= 3){
    delete db.warns[from][key];
    F.saveDB(db);
    await sock.sendMessage(from, { text: `🚫 @${getNums(sender)[0]} don reach 3 warnings for sending link. Kicking...`, mentions:[sender] }).catch(()=>{});
    if(perms.isBotAdmin){
      await sock.groupParticipantsUpdate(from, [sender], 'remove').catch(e=>console.log('Kick failed:', e.message));
    } else {
      await sock.sendMessage(from, { text: `❌ I no fit kick - make bot admin first, then I go kick am.` }).catch(()=>{});
    }
  } else {
    await sock.sendMessage(from, { text: `⚠️ @${getNums(sender)[0]} No link allowed here!\nWarning ${count}/3 - Next na kick.\nLink deleted ✅`, mentions:[sender] }).catch(()=>{});
  }
  return true;
}
async function builtInAuto(sock, m, from, db){
  const auto = db.auto || {};
  try{ if(auto.autoread || auto.read) await sock.readMessages([m.key]).catch(()=>{}); }catch{}
}
async function builtInAutoStatus(sock, message){
  const auto = db.auto || {};
  try{
    if(auto.autoview || auto.autoviewstatus || auto.viewstatus) await sock.readMessages([message.key]).catch(()=>{});
    if(auto.autolike || auto.autolikestatus) await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: message.key } }).catch(()=>{});
  }catch(e){ console.log('Auto status error:', e.message); }
}
async function start(){
  if(isStarting) return; isStarting=true;
  if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer=null; }
  try{
    const sessionFolder=config.sessionFolder || './Meta';
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ version, logger:pino({level:'silent'}), browser:Browsers.macOS('Safari'), auth:state, printQRInTerminal:false, markOnlineOnConnect:true, syncFullHistory:false, shouldSyncHistoryMessage:()=>false, connectTimeoutMs:60000, keepAliveIntervalMs:10000, getMessage:async()=>undefined });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async update=>{
      const { connection, lastDisconnect } = update;
      if(connection==='connecting') console.log('🔄 Connecting...');
      if(connection==='open'){
        isStarting=false; console.log('✅ META AI MD CONNECTED - Commands:', commands.size);
        for(let fn of getHandler('startAutoBio')){ try{ await fn(sock, db, config); }catch(e){ console.log('Auto bio error:', e.message); } }
      }
      if(connection==='close'){
        isStarting=false;
        const code=lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed:', code);
        if(code===DisconnectReason.loggedOut){ console.log('❌ Session logged out. Pair again.'); return; }
        if(!reconnectTimer) reconnectTimer=setTimeout(()=>{ reconnectTimer=null; start(); },5000);
      }
    });
    sock.ev.on('messages.upsert', async ({messages})=>{
      for(let message of messages){
        try{
          if(message.key?.remoteJid!=='status@broadcast') continue;
          await builtInAutoStatus(sock, message);
          for(let fn of getHandler('handleStatus')) await fn(sock, message, db, F, config);
        }catch(e){ console.log('Status handler error:', e.message); }
      }
    });
    sock.ev.on('messages.update', async updates=>{
      try{ for(let fn of getHandler('handleDelete')) await fn(sock, updates, db, F, config); }catch(e){ console.log('Anti-delete error:', e.message); }
    });
    sock.ev.on('group-participants.update', async update=>{
      try{
        for(let fn of getHandler('handleParticipantProtection')) await fn(sock, update, db, F, config);
        let handled=false;
        for(let fn of getHandler('handleParticipants')){ await fn(sock, update, db, F, config); handled=true; }
        if(!handled){
          const from=update.id; const group=db.group?.[from]; if(!group) return;
          for(let participant of update.participants||[]){
            // CHANGED: F.getPn now returns number only, so @${pn} works
            let pn = F.getPn ? F.getPn(participant) : participant.split('@')[0];
            try{ let md=await sock.groupMetadata(from); let p = F.findParticipant ? F.findParticipant(md, participant) : null; if(p?.phoneNumber) pn=getNums(p.phoneNumber)[0]; }catch{}
            if(update.action==='add' && (group.welcome || db.auto?.autowelcome)){
              let msg=(group.welcomeMsg||'👋 Welcome @user to *{group}*!\n\nType .menu').replace(/@user/g,`@${pn}`).replace(/\{group\}/g, update.subject||'group');
              await sock.sendMessage(from,{text:msg, mentions:[participant]}).catch(()=>{});
            }
            if(update.action==='remove' && (group.goodbye || db.auto?.autogoodbye)){
              let msg=(group.goodbyeMsg||'👋 Bye @user!').replace(/@user/g,`@${pn}`);
              await sock.sendMessage(from,{text:msg, mentions:[participant]}).catch(()=>{});
            }
          }
        }
      }catch(e){ console.log('Group event error:', e.message); }
    });
    sock.ev.on('messages.upsert', async ({messages})=>{
      for(let m of messages){
        try{
          if(!m?.message) continue;
          const from=m.key.remoteJid; if(!from || from==='status@broadcast') continue;
          const sender=m.key.participant || from;
          const senderPn=m.key.participantPn || m.key.remoteJidAlt || sender;
          const senderNums=getNums(sender, senderPn);
          const pushname=m.pushName||'User';
          const body=F.getText(m) || '';
          const isGroup=F.isGroup(from);
          let isOwner=isOwnerCheck(sender, senderPn, db);
          if(m.key.fromMe){
            let prefixes=getPrefixes();
            if(!prefixes.some(p=>body.startsWith(p))) continue;
            isOwner=true;
          }
          if(!isOwner && db.banned?.length && senderNums.some(n=>db.banned.includes(n))) continue;
          let permissions={isAdmin:false,isBotAdmin:false,metadata:null};
          if(isGroup) permissions=await getGroupPermissions(from, sender, senderPn);
          if(isOwner) permissions.isAdmin=true;
          if(!m.key.fromMe) await builtInAuto(sock, m, from, db);
          let blockedByAnti = false;
          if(!m.key.fromMe && isGroup && !isOwner){
            blockedByAnti = await builtInAntiLink(sock, m, from, sender, senderPn, body, permissions, isOwner);
            if(blockedByAnti){ F.saveDB(db); continue; }
          }
          if(!blockedByAnti && !m.key.fromMe){
            try{
              for(let fn of getHandler('handleMuted')){ let blocked=await fn(sock, m, db, F, config); if(blocked){ F.saveDB(db); blockedByAnti = true; break; } }
              if(!blockedByAnti && !getHandler('handleMuted').length && isGroup && db.muted?.[from]?.length){
                let hit=db.muted[from].some(x=> senderNums.includes(getNums(x)[0]) || x===sender || x===senderPn);
                if(hit && !isOwner && !permissions.isAdmin){ await sock.sendMessage(from,{delete:m.key}).catch(()=>{}); blockedByAnti = true; }
              }
            }catch(e){ console.log('Muted handler error:', e.message); }
            if(!blockedByAnti){
              try{ for(let fn of getHandler('handleProtection')){ let blocked=await fn(sock, m, db, F, config); if(blocked){ F.saveDB(db); blockedByAnti = true; break; } } }catch(e){ console.log('Protection handler error:', e.message); }
            }
            if(!blockedByAnti){
              try{ for(let fn of getHandler('handleAnti')){ let blocked=await fn(sock, m, db, F, config); if(blocked){ F.saveDB(db); blockedByAnti = true; break; } } }catch(e){ console.log('Anti handler error:', e.message); }
            }
            if(!blockedByAnti){
              try{ for(let fn of getHandler('handleAuto')) await fn(sock, m, db, F, config); }catch(e){ console.log('Auto handler error:', e.message); }
            }
          }
          if(blockedByAnti) continue;
          if(getMode(db)==='private' && !isOwner) continue;
          if(!body) continue;
          const prefixes=getPrefixes();
          const usedPrefix=prefixes.find(p=>body.startsWith(p));
          if(!usedPrefix) continue;
          const args=body.slice(usedPrefix.length).trim().split(/\s+/);
          const cmdName=(args.shift()||'').toLowerCase();
          const text=args.join(' ');
          const reply=async (message, options={})=> sock.sendMessage(from,{text:String(message), ...options},{quoted:m});
          const fancyReply=async (message, options={})=> reply(fancy(message), options);
          if(['menu','help','allmenu'].includes(cmdName)){
            try{
              // MENU NOT TOUCHED - uses your lib/menu.js exactly
              const menuText=getMenu({ownerName:config.ownerAlias, prefix:usedPrefix, botUser:config.botName, hosting:config.hosting});
              return await sock.sendMessage(from,{image:{url:MENU_PFP}, caption:menuText},{quoted:m});
            }catch(e){ return reply('Menu error: '+e.message); }
          }
          if(cmdName==='reload' && isOwner){ loadPlugins(); return reply(`✅ ${fancy('Plugins reloaded')}\nCommands: ${commands.size}`); }
          // CHANGED: ctx now uses F from changed function - includes getTarget, downloadMedia, etc
          const ctx={ sock, m, from, sender, senderNum:getNums(sender)[0], senderPn, senderNums, pushname, args, text, q:text, cmd:cmdName, cmdName, prefix:usedPrefix, isOwner, isGroup, isAdmin:permissions.isAdmin, isBotAdmin:permissions.isBotAdmin, metadata:permissions.metadata, db, config, F, reply, fancy, fancyReply };
          let handled=false;
          for(let plugin of functionPlugins){
            try{ let result=await plugin.fn(sock, m, ctx); if(result){ handled=true; F.saveDB(db); break; } }catch(e){ console.log('Function plugin error:', plugin.file, e.message); }
          }
          if(handled) continue;
          const plugin=commands.get(cmdName);
          if(!plugin){ await reply(`❌ Unknown command: ${usedPrefix}${cmdName}\nType ${usedPrefix}menu`); continue; }
          if(plugin.ownerOnly && !isOwner){ await reply(config.messages?.ownerOnly || '❌ Owner only command.'); continue; }
          if(plugin.groupOnly && !isGroup){ await reply(config.messages?.groupOnly || '❌ Group only command.'); continue; }
          if(plugin.adminOnly && !permissions.isAdmin && !isOwner){ await reply('❌ Admins only.'); continue; }
          if((plugin.botAdminOnly || plugin.botAdmin) && !permissions.isBotAdmin){ await reply('❌ The bot must be an admin. Make bot admin first.'); continue; }
          try{ await plugin.run(ctx); }catch(e){ console.log(`Cmd ${cmdName} error:`, e.message); await reply(`❌ Command error: ${e.message}`); }
          F.saveDB(db);
        }catch(e){ console.log('Message handler error:', e.message); }
      }
    });
  }catch(e){
    console.log('Start failed:', e.message); isStarting=false;
    if(!reconnectTimer) reconnectTimer=setTimeout(()=>{ reconnectTimer=null; start(); },5000);
  }
}
start();
process.on('uncaughtException', e=>console.log('Uncaught exception:', e.message));
process.on('unhandledRejection', e=>console.log('Unhandled rejection:', e.message));
