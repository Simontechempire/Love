// LOVE - INDEX.JS - CONVERTED FROM WOLF connection.js - SIMON TECH INC
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

// FIX 1: SIMPLE CACHE WITHOUT node-cache MODULE
const msgRetryCounterCache = {
  _cache: new Map(),
  get(k){ return this._cache.get(k); },
  set(k,v){ this._cache.set(k,v); return v; },
  del(k){ this._cache.delete(k); },
  has(k){ return this._cache.has(k); }
};

// LOVE CONFIG - YOUR NUMBER
let config;
try { config = require('./config'); } catch {
  config = { botName: "LOVE", ownerName: "Simon Tech", ownerNumber: "2348071569915", prefix: ".", sessionName: "auth_love", PORT: process.env.PORT || 10000 };
}
config.ownerNumber = config.ownerNumber || "2348071569915";
config.botName = "LOVE";
config.sessionName = config.sessionFolder || "auth_love";
if(!config.prefix) config.prefix = ".";

global.sock = null; global.isConnected = false; global.connectionStatus = '⚠️ NOT LINKED'; global.pairingCode = null; global.currentPairingNumber = null; global.lastPairTime = 0; global.appStarted = false;

global.db = global.db || {};
global.db.groups = global.db.groups || {};
global.db.settings = global.db.settings || { prefix: ".", mode: "public", autoread: false, autostatus: true, autovv: true, autolike: false, autoreact: false, autotyping: false, autopresence: false, autoreply: false, anticall: true };
global.db.banned = global.db.banned || [];
global.db.warnings = global.db.warnings || {};
global.db.messages = global.db.messages || {};
global.db.spam = global.db.spam || {};
global.db.sudo = global.db.sudo || [config.ownerNumber + '@s.whatsapp.net', "2348071569915@s.whatsapp.net"];

function getGroup(jid){
  global.db.groups[jid] = global.db.groups[jid] || { antilink:false, antibot:false, antispam:false, antiviewonce:true, antidelete:true, welcome:false, goodbye:false, welcomeText:"", goodbyeText:"" };
  return global.db.groups[jid];
}

global.plugins=new Map();
global.wolfCommands={};
global.loveCommands={};

function loadPlugins(){ 
  const possiblePaths = [path.join(__dirname,'plugins'), path.join(__dirname,'../plugins'), path.join(__dirname,'src/plugins')];
  let pPath = null;
  for(const pp of possiblePaths){ if(fs.existsSync(pp)){ pPath=pp; break; } }
  if(!pPath) { console.log(chalk.red('No plugins folder found')); return; }
  global.plugins.clear(); 
  global.wolfCommands={}; global.loveCommands={};
  let t=0; 
  const IGNORED = ['main.js','index.js','connection.js','settings.js','config.js','app.js','bot.js','server.js'];
  function rd(dir){ 
    const items=fs.readdirSync(dir); 
    for(const it of items){ 
      const full=path.join(dir,it); 
      const st=fs.statSync(full); 
      if(st.isDirectory()){
        if(it === 'node_modules' || it.startsWith('.') || IGNORED.includes(it)) continue;
        rd(full); 
      }
      else if(it.endsWith('.js')){ 
        if(IGNORED.includes(it)) continue;
        try{ 
          delete require.cache[require.resolve(full)]; 
          const d=require(full); 
          const arr=Array.isArray(d)?d:[d]; 
          for(const pl of arr){ 
            if(pl&&pl.name&&pl.execute){ 
              global.plugins.set(pl.name.toLowerCase(),pl); 
              global.wolfCommands[pl.name.toLowerCase()]=pl.execute;
              global.loveCommands[pl.name.toLowerCase()]=pl.execute;
              if(pl.alias) for(const a of pl.alias) {
                global.plugins.set(a.toLowerCase(),pl);
                global.wolfCommands[a.toLowerCase()]=pl.execute;
                global.loveCommands[a.toLowerCase()]=pl.execute;
              }
              t++; 
            } else if(pl&&pl.command&&pl.execute){
              for(const cmd of pl.command){
                const clean=cmd.toLowerCase();
                global.plugins.set(clean, pl);
                global.wolfCommands[clean]=pl.execute;
                global.loveCommands[clean]=pl.execute;
                global.wolfCommands[clean.replace(/[^a-z0-9]/g,'')]=pl.execute;
                global.loveCommands[clean.replace(/[^a-z0-9]/g,'')]=pl.execute;
              }
              t++;
            } else if(pl&&pl.name&&pl.run){
              // LOVE style: {name, run}
              const wrapped = async (sock,m,ctx)=>{ await pl.run({sock,m,from:m.chat,sender:m.sender,pushname:m.pushName,args:m.args,text:m.text,cmd:ctx.command,prefix:ctx.prefix,isOwner:m.isOwner,isGroup:m.isGroup,db:global.db,config,reply:m.reply}); };
              global.plugins.set(pl.name.toLowerCase(),{...pl, execute:wrapped});
              global.wolfCommands[pl.name.toLowerCase()]=wrapped;
              global.loveCommands[pl.name.toLowerCase()]=wrapped;
              if(pl.aliases) for(const a of pl.aliases){ global.plugins.set(String(a).toLowerCase(),{...pl, execute:wrapped}); global.wolfCommands[String(a).toLowerCase()]=wrapped; global.loveCommands[String(a).toLowerCase()]=wrapped; }
              t++;
            }
          } 
        }catch(e){ console.log(`Load err ${it}: ${e.message}`)} 
      } 
    } 
  } 
  rd(pPath); 
  console.log(chalk.green(`✅ LOVE WIRED ${t} files | ${Object.keys(global.wolfCommands).length} CMDS from ${pPath}`)); 
}
loadPlugins();

const groupCache=new Map();
async function getCachedMeta(sock,jid){
  const c=groupCache.get(jid); if(c && Date.now()-c.time<90000) return c.meta;
  try{ const meta=await sock.groupMetadata(jid); groupCache.set(jid,{meta,time:Date.now()}); if(groupCache.size>50) groupCache.delete(groupCache.keys().next().value); return meta; }catch{ return null; }
}

async function startConnection(){
  if(!global.appStarted){
    const app=express(); 
    app.use(express.json()); 
    app.use(express.urlencoded({ extended: true }));
    // LOVE: serve pairing page FIRST
    app.use(express.static(path.join(__dirname,'public')));
    app.use(express.static(__dirname));
    
    app.get('/',(req,res)=>{
      const idx1 = path.join(__dirname,'public','index.html');
      const idx2 = path.join(__dirname,'index.html');
      if(fs.existsSync(idx1)) return res.sendFile(idx1);
      if(fs.existsSync(idx2)) return res.sendFile(idx2);
      res.send(`<h1>LOVE</h1><p>Owner: 2348071569915</p><p>CMDS: ${Object.keys(global.wolfCommands).length}</p><p><a href="/api/status">Status</a> | <a href="/getcode?number=2348071569915">Get Code</a></p>`);
    });
    app.get('/health',(req,res)=>res.send('LOVE LIVE'));
    app.get('/ping',(req,res)=>res.send('pong'));
    app.get('/api/status',(req,res)=>res.json({ botName:"LOVE", owner:"2348071569915", status:global.connectionStatus, isConnected:global.isConnected, connected:global.isConnected, pairingCode:global.pairingCode, plugins:Object.keys(global.wolfCommands).length, commands:Object.keys(global.wolfCommands).length, mode:global.db.settings.mode||"public" }));
    app.get('/status',(req,res)=>res.json({ botName:"LOVE", owner:"2348071569915", status:global.connectionStatus, isConnected:global.isConnected, connected:global.isConnected, pairingCode:global.pairingCode, plugins:Object.keys(global.wolfCommands).length, commands:Object.keys(global.wolfCommands).length, mode:global.db.settings.mode||"public" }));

    // LOVE pairing - works with new LOVE pairing page
    async function doPair(phone, res){
      try{
        phone=(phone||'').replace(/[^0-9]/g,'');
        if(phone.length<10) return res.json({success:false,message:'Enter valid number e.g 2348071569915', error:'Enter valid number'});
        if(!global.sock) return res.json({success:false,message:'Bot starting... wait 5 sec', error:'Bot starting... wait 5 sec'});
        if(global.isConnected) return res.json({success:false,message:'Already linked!', error:'Already linked!'});
        const code=await global.sock.requestPairingCode(phone); 
        global.pairingCode=code; 
        global.currentPairingNumber=phone;
        global.connectionStatus=`CODE: ${code}`; 
        console.log(chalk.yellow(`🔑 LOVE CODE ${phone}: ${code}`)); 
        return res.json({success:true,code,phone});
      }catch(e){ console.log('Pair fail',e.message); return res.json({success:false,message:e.message, error:e.message}); }
    }
    app.post('/api/pair',async(req,res)=>{ await doPair(req.body.phone||req.body.number||'', res); });
    app.get('/pair',async(req,res)=>{ await doPair(req.query.number||req.query.phone||'', res); });
    app.get('/pair-code',async(req,res)=>{ await doPair(req.query.phone||req.query.number||'', res); });
    app.get('/getcode',async(req,res)=>{ await doPair(req.query.number||req.query.phone||'', res); });

    app.post('/api/logout',async(req,res)=>{ try{ if(global.sock) await global.sock.logout().catch(()=>{}); }catch{} try{ fs.rmSync(`./${config.sessionName}`,{recursive:true,force:true}); fs.rmSync(`./auth`,{recursive:true,force:true}); }catch{} global.sock=null; global.isConnected=false; res.json({success:true}); setTimeout(()=>initBaileys(),2000); });
    app.get('/clear-session',async(req,res)=>{ try{ if(global.sock) await global.sock.logout().catch(()=>{}); }catch{} try{ fs.rmSync(`./${config.sessionName}`,{recursive:true,force:true}); }catch{} global.sock=null; global.isConnected=false; res.json({success:true, message:'Session cleared. Restart service, then pair again.'}); setTimeout(()=>initBaileys(),2000); });
    
    const PORT=config.PORT||process.env.PORT||10000; 
    app.listen(PORT,'0.0.0.0',()=>console.log(chalk.cyan(`🌐 LOVE Dashboard ${PORT} | ${Object.keys(global.wolfCommands).length} CMDS`))); 
    global.appStarted=true;
  }

  async function initBaileys(){
    try{
      const authPath=`./${config.sessionName}`;
      if((!fs.existsSync(authPath)||fs.readdirSync(authPath).length===0)&&process.env.SESSION_DATA){
        fs.mkdirSync(authPath,{recursive:true}); let d; try{ d=JSON.parse(process.env.SESSION_DATA); }catch{ d=JSON.parse(Buffer.from(process.env.SESSION_DATA,'base64').toString()); } fs.writeFileSync(path.join(authPath,'creds.json'),JSON.stringify(d,null,2));
      }
    }catch(e){}
    const {state,saveCreds}=await useMultiFileAuthState(`./${config.sessionName}`); 
    const {version}=await fetchLatestBaileysVersion();
    const sock=makeWASocket({ 
      version, 
      logger:pino({level:'silent'}), 
      printQRInTerminal:false, 
      browser:Browsers.macOS('Safari'), 
      auth:{creds:state.creds,keys:makeCacheableSignalKeyStore(state.keys,pino({level:'silent'}))}, 
      markOnlineOnConnect:false,
      connectTimeoutMs:60000, 
      keepAliveIntervalMs:10000, 
      syncFullHistory:false, 
      retryRequestDelayMs:2000,
      msgRetryCounterCache,
      getMessage: async () => undefined,
      generateHighQualityLinkPreview: false,
      shouldSyncHistoryMessage: () => false
    });
    global.sock=sock; sock.ev.on('creds.update',saveCreds);

    sock.ev.on('call',async(calls)=>{ for(let c of calls){ try{ if(global.db.settings.anticall) await sock.rejectCall(c.id,c.from); }catch{} } });
    sock.ev.on('messages.update',async(updates)=>{ for(let up of updates){ if(up.update.message===null){ const saved=global.db.messages[up.key.id]; if(!saved) continue; const g=getGroup(saved.from); if(!g.antidelete) continue; try{ await sock.sendMessage(saved.from,{text:`*🔍 ANTI-DELETE LOVE*\nFrom: @${saved.sender.split('@')[0]}\n> ${saved.text?.slice(0,300)}`,mentions:[saved.sender]}); }catch{} } } });

    sock.ev.on('connection.update',async(update)=>{
      const {connection,lastDisconnect}=update;
      if(connection==='connecting') global.connectionStatus='Connecting LOVE...';
      if(connection==='open'){
        global.isConnected=true; global.connectionStatus='ONLINE ✅ LOVE'; console.log(chalk.green.bold(`\n✅ LOVE ONLINE! ${Object.keys(global.wolfCommands).length} CMDS\n`)); loadPlugins();
        try{ 
          const jid=sock.user.id; 
          await new Promise(r=>setTimeout(r,2000));
          await sock.sendMessage(jid,{text:`✅ *LOVE LINKED*\n\n👤 ${sock.user.name||'Simon'}\n🔣 Prefix: .\n⚡ ${Object.keys(global.wolfCommands).length} CMDS\n\nType .menu - Owner 2348071569915`}).catch(()=>{}); 
        }catch{}
      }
      if(connection==='close'){
        const code=lastDisconnect?.error?.output?.statusCode; console.log(chalk.red(`❌ Closed ${code}`)); global.isConnected=false; global.sock=null; groupCache.clear();
        if([DisconnectReason.loggedOut,401,440,405].includes(code)){ try{ fs.rmSync(`./${config.sessionName}`,{recursive:true,force:true}); }catch{} global.connectionStatus='LOGGED OUT'; setTimeout(()=>initBaileys(),3000); }
        else{ global.connectionStatus='Reconnecting LOVE...'; setTimeout(()=>initBaileys(),5000); }
      }
    });

    sock.ev.on('messages.upsert',async({messages,type})=>{
      try{
        if(type!=='notify') return; const m=messages[0]; if(!m?.message) return; const from=m.key.remoteJid;
        if(from==='status@broadcast'){ if(global.db.settings.autostatus){ await sock.readMessages([m.key]).catch(()=>{}); } return; }
        const sender=m.key.participant||from; const isGroup=from.endsWith('@g.us'); const body=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||"";
        if(m.key.id){ global.db.messages[m.key.id]={text:body,sender,from,time:Date.now(), message:m.message}; if(Object.keys(global.db.messages).length>150) delete global.db.messages[Object.keys(global.db.messages)[0]]; }
        if(global.db.settings.autoread) await sock.readMessages([m.key]).catch(()=>{});
        if(isGroup){
          const g=getGroup(from);
          if((global.db.settings.autovv||g.antiviewonce)&&(m.message.viewOnceMessage||m.message.viewOnceMessageV2||m.message.viewOnceMessageV2Extension)){
            try{ const q=m.message.viewOnceMessage||m.message.viewOnceMessageV2Extension; const inner=q?.message||q; if(inner?.imageMessage) await sock.sendMessage(from,{image:inner.imageMessage},{quoted:m}).catch(()=>{}); else if(inner?.videoMessage) await sock.sendMessage(from,{video:inner.videoMessage},{quoted:m}).catch(()=>{}); else await sock.sendMessage(from,{forward:q},{quoted:m}).catch(()=>{}); }catch{}
          }
        }
        if(!body) return; const prefix=global.db.settings.prefix||config.prefix||'.'; if(!body.trim().startsWith(prefix)) return;
        const args=body.trim().slice(prefix.length).trim().split(/ +/); const rawCmd=args.shift()?.toLowerCase(); if(!rawCmd) return;
        const cmdName=rawCmd.replace(/[^a-z0-9]/g,'')||rawCmd;
        let plugin = global.plugins.get(rawCmd) || global.plugins.get(cmdName) || global.wolfCommands[rawCmd] || global.wolfCommands[cmdName];
        if(!plugin){
          const fn = global.wolfCommands[rawCmd] || global.wolfCommands[cmdName];
          if(fn && typeof fn === 'function'){ plugin = { execute: fn, isWolfStyle: true }; }
        }
        if(!plugin) return; 
        if(global.db.banned.includes(sender)) return;
        
        m.body=body; m.text=args.join(' '); m.args=args; m.sender=sender; m.chat=from; m.from=from; m.isGroup=isGroup; m.fromMe=m.key.fromMe; m.pushName=m.pushName||"Simon"; 
        m.isOwner=sender.includes('2348071569915') || global.db.sudo.includes(sender) || m.key.fromMe;
        m.reply=async(txt)=>await sock.sendMessage(from,{text:txt},{quoted:m});
        m.download=async()=>await downloadMediaMessage(m,'buffer',{},{logger:pino({level:"silent"}),reuploadRequest:sock.updateMediaMessage});
        
        console.log(chalk.green(`▶️ ${rawCmd} ${sender.split('@')[0]}`));
        
        if(plugin.isWolfStyle || typeof plugin === 'function' || plugin.execute.length===3 || global.wolfCommands[rawCmd]){
          const execFn = typeof plugin === 'function' ? plugin : (plugin.execute || global.wolfCommands[rawCmd] || global.wolfCommands[cmdName]);
          if(typeof execFn === 'function'){
            await execFn(sock, m, {command:cmdName, text:args.join(' '), args, reply:m.reply, isOwner:m.isOwner, prefix});
          }
        } else {
          await plugin.execute(m,{sock,prefix,args,command:cmdName,config,plugins:global.plugins,from,sender,getGroup});
        }
      }catch(e){ console.log(chalk.red(`Exec err: ${e.message} ${e.stack}`)); }
    });
  }
  await initBaileys();
}

module.exports={startConnection};
module.exports.AlphaOmegaConnection=startConnection;

if(require.main===module){
  startConnection().catch(e=>{ console.log(e.message); setTimeout(()=>startConnection(), 3000); });
            }
