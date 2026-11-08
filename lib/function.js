// META AI MD - Helper Functions - CHANGED
// Developer: SIMON TECH INC - FIXED LID + PN + META INDEX COMPAT
// lib/menu.js NOT TOUCHED

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');

// CHANGED: Owner now from config.js, not hardcoded. Fallback to old number if config missing.
let OWNER = '2348102350169';
try { const cfg = require('../config'); if (cfg.ownerNumber) OWNER = String(cfg.ownerNumber).replace(/[^0-9]/g,''); } catch {}
const FOOTER = '©️ Created by Simon Tech Inc';
const DB_FILE = path.join(__dirname, '../database.json');

// ---------- HELPERS ----------
function cleanNumber(text){ return String(text || '').replace(/[^0-9]/g, ''); }
function getNum(jid){ return String(jid||'').split('@')[0].split(':')[0].replace(/[^0-9]/g,''); }
function getNums(...jids){ let o=[]; for(let j of jids){ let n=getNum(j); if(n) o.push(n); } return [...new Set(o)]; }

// CHANGED: Added fancy / bold - index.js + plugins use F.fancy
function fancy(text){
  const map={a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',K:'𝐊',L:'𝐋',M:'𝐌',N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙',0:'𝟎',1:'𝟏',2:'𝟐',3:'𝟑',4:'𝟒',5:'𝟓',6:'𝟔',7:'𝟕',8:'𝟖',9:'𝟗'};
  return String(text).split('').map(c=>map[c]||c).join('');
}

// ---------- DATABASE ----------
function loadDB(){
  let db=null;
  try{
    if(fs.existsSync(DB_FILE)) db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
  }catch(e){ console.error('Database load error:', e.message); }
  if(!db || typeof db!=='object') db={};
  db.owners = Array.isArray(db.owners) ? db.owners : [];
  if(!db.owners.includes(OWNER)) db.owners.push(OWNER);
  // CHANGED: also add config owners
  try{ const cfg=require('../config'); if(cfg.owners) cfg.owners.forEach(o=>{ let n=cleanNumber(o); if(n && !db.owners.includes(n)) db.owners.push(n); }); }catch{}
  if(!db.owner) db.owner=OWNER;
  db.settings = { prefix:'.', mode:'public', botName:'META AI MD', ...(db.settings||{}) };
  for(const key of ['auto','anti','warns','welcome','goodbye','rules','chat','group','banned','muted','bots']){
    if(key==='banned' || key==='muted' || key==='bots'){
      if(key==='banned' && !Array.isArray(db.banned)) db.banned=[];
      if(key==='bots' && !Array.isArray(db.bots)) db.bots=[];
      if(key==='muted' && (!db.muted || typeof db.muted!=='object')) db.muted={};
    } else {
      db[key]=db[key]||{};
    }
  }
  return db;
}
function saveDB(db){
  try{ fs.mkdirSync(path.dirname(DB_FILE),{recursive:true}); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); return true; }
  catch(e){ console.error('Database save error:', e.message); return false; }
}

// ---------- OWNER ----------
function isOwner(jid, db, extraJid){
  let nums=getNums(jid, extraJid);
  if(!nums.length) return false;
  if(nums.includes(OWNER)) return true;
  let owners=[];
  if(db?.owner) owners.push(...getNums(db.owner));
  if(Array.isArray(db?.owners)) db.owners.forEach(o=>owners.push(...getNums(o)));
  if(db?.settings?.owner) owners.push(...getNums(db.settings.owner));
  return nums.some(n=>owners.includes(n));
}
function isOwnerMessage(m, db, config){
  let sender=m?.key?.participant || m?.key?.remoteJid;
  let senderPn=m?.key?.participantPn || m?.key?.remoteJidAlt || sender;
  if(isOwner(sender, db, senderPn)) return true;
  if(config?.ownerNumber && getNums(sender, senderPn).includes(getNum(config.ownerNumber))) return true;
  if(Array.isArray(config?.owners) && config.owners.some(o=>getNums(sender, senderPn).includes(getNum(o)))) return true;
  return false;
}

// ---------- TARGET ----------
function getTarget(m, args=[]){
  let ctxInfo = m?.message?.extendedTextMessage?.contextInfo || m?.message?.imageMessage?.contextInfo || m?.message?.videoMessage?.contextInfo || m?.message?.documentMessage?.contextInfo || m?.message?.stickerMessage?.contextInfo || {};
  if(ctxInfo.mentionedJid?.length) return ctxInfo.mentionedJid[0];
  if(ctxInfo.participant) return ctxInfo.participant;
  if(args?.[0]){
    let number=cleanNumber(args[0]);
    if(number.length>=7) return number+'@s.whatsapp.net';
  }
  return null;
}

// CHANGED: getPn now ALWAYS returns number only, not JID.
// Old version returned JID if not @lid -> broke @mention in index.js welcome/goodbye
function getPn(jid, md){
  if(!jid) return '';
  // If LID and metadata given, resolve to PN number
  if(String(jid).endsWith('@lid') && md){
    let p=findParticipant(md, jid);
    if(p?.phoneNumber) return getNum(p.phoneNumber);
    if(p?.id) return getNum(p.id);
  }
  return getNum(jid);
}
async function lidToPn(jid, mdOrSock, groupJid){
  if(!String(jid||'').endsWith('@lid')) return jid;
  try{
    let md=null;
    if(mdOrSock && mdOrSock.participants) md=mdOrSock;
    else if(mdOrSock && groupJid) md=await mdOrSock.groupMetadata(groupJid).catch(()=>null);
    if(md){ let p=findParticipant(md, jid); if(p?.phoneNumber) return p.phoneNumber; }
  }catch{}
  return jid;
}

// ---------- TEXT - CHANGED: buttons + list + interactive ----------
function getText(m){
  let msg=m?.message||{};
  if(msg.ephemeralMessage?.message) msg=msg.ephemeralMessage.message;
  if(msg.viewOnceMessage?.message) msg=msg.viewOnceMessage.message;
  if(msg.viewOnceMessageV2?.message) msg=msg.viewOnceMessageV2.message;
  if(msg.documentWithCaptionMessage?.message) msg=msg.documentWithCaptionMessage.message;
  return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || msg.documentMessage?.caption || msg.buttonsResponseMessage?.selectedButtonId || msg.listResponseMessage?.title || msg.templateButtonReplyMessage?.selectedId || msg.interactiveResponseMessage?.body?.text || '';
}
function getQuoted(m){
  let msg=m?.message||{};
  if(msg.ephemeralMessage?.message) msg=msg.ephemeralMessage.message;
  return msg.extendedTextMessage?.contextInfo?.quotedMessage || msg.imageMessage?.contextInfo?.quotedMessage || msg.videoMessage?.contextInfo?.quotedMessage || null;
}
function isGroup(jid){ return String(jid||'').endsWith('@g.us'); }
function isChannel(jid){ return String(jid||'').endsWith('@newsletter'); }

// ---------- GROUP ----------
function findParticipant(md, uid){
  if(!md || !uid) return null;
  let nums=getNums(uid);
  return (md.participants||[]).find(p=>{
    if(p.id===uid || p.phoneNumber===uid) return true;
    return getNums(p.id, p.phoneNumber, p.lid).some(n=>nums.includes(n));
  });
}
async function getGroupMeta(sock, jid){
  try{ return await sock.groupMetadata(jid); }catch{ return null; }
}
async function getAdmins(sock, jid){
  try{
    const md=await sock.groupMetadata(jid);
    const participants=md.participants||[];
    return {
      md,
      admins: participants.filter(p=>p.admin).map(p=>p.id),
      all: participants.map(p=>p.id),
      isAdmin: (id)=>{ let p=findParticipant(md, id); return !!p?.admin; },
      isBotAdmin: (sock2)=>{ let s=sock2||sock; let p=findParticipant(md, s.user?.id) || findParticipant(md, s.user?.lid); return !!p?.admin; }
    };
  }catch{ return { md:null, admins:[], all:[], isAdmin:()=>false, isBotAdmin:()=>false }; }
}

// ---------- MEDIA ----------
async function downloadMedia(m){
  try{
    let msg=m.message||{};
    if(msg.ephemeralMessage?.message) msg=msg.ephemeralMessage.message;
    if(msg.viewOnceMessage?.message) msg=msg.viewOnceMessage.message;
    if(msg.viewOnceMessageV2?.message) msg=msg.viewOnceMessageV2.message;
    const type=getContentType(msg);
    if(!type || !type.endsWith('Message')) return null;
    const stream=await downloadContentFromMessage(msg[type], type.replace('Message','').toLowerCase());
    const chunks=[]; for await(const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }catch(e){ console.error('Media download error:', e.message); return null; }
}

// ---------- HTTP ----------
async function getBuffer(url, opts={}){ const r=await axios.get(url,{responseType:'arraybuffer', timeout:30000, ...opts}); return Buffer.from(r.data); }
async function fetchJson(url, opts={}){ const r=await axios.get(url,{timeout:20000, ...opts}); return r.data; }
async function fetchText(url){ const r=await axios.get(url,{timeout:20000}); return r.data; }

// ---------- TIME ----------
function runtime(){ const s=Math.floor(process.uptime()); const h=Math.floor(s/3600); const mi=Math.floor((s%3600)/60); const se=s%60; return `${h}h ${mi}m ${se}s`; }
function formatUptime(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); const sec=s%60; if(d>0) return `${d}d ${h}h ${m}m`; if(h>0) return `${h}h ${m}m ${sec}s`; if(m>0) return `${m}m ${sec}s`; return `${sec}s`; }
function formatNumber(n){ return Number(n).toLocaleString('en-US'); }

// ---------- REPLY ----------
function makeReply(sock){
  return async (m, text, opts={})=> sock.sendMessage(m.key.remoteJid, {text:String(text)+'\n\n'+FOOTER, ...opts}, {quoted:m});
}

module.exports={
  OWNER, FOOTER, loadDB, saveDB,
  isOwner, isOwnerMessage, cleanNumber, getNum, getNums,
  getTarget, getText, getQuoted, isGroup, isChannel,
  findParticipant, getGroupMeta, getAdmins, getPn, lidToPn,
  downloadMedia, getBuffer, fetchJson, fetchText, runtime, formatUptime, formatNumber, makeReply,
  fancy, bold: fancy
};
