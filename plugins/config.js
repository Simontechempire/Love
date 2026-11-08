const fs=require('fs'); const path=require('path');
const config=require('../config');
const cfgFile=path.join(__dirname,'../Lib/data/config.json');
function rc(){try{return JSON.parse(fs.readFileSync(cfgFile));}catch{return {};}}function wc(d){if(!fs.existsSync(path.dirname(cfgFile)))fs.mkdirSync(path.dirname(cfgFile),{recursive:true});fs.writeFileSync(cfgFile,JSON.stringify(d,null,2));}
function isOwner(sender){return sender.split('@')[0]===config.ownerNumber;}
const mk=(n,a,f)=>({name:n,alias:[a],category:'CONFIG',run:f});
const guard=(fn)=>async(ctx)=>{ if(!isOwner(ctx.sender)) return ctx.sock.sendMessage(ctx.from,{text:`❌ Owner only.`,mentions:[ctx.sender]}); await fn(ctx); };
const setvar=mk('setvar','ꜱᴇᴛᴠᴀʀ',guard(async({sock,from,sender,text})=>{const [k,...rest]=text.split(' ');if(!k||!rest.length)return sock.sendMessage(from,{text:`❌ .setvar <key> <value>`,mentions:[sender]});const d=rc();d[k]=rest.join(' ');wc(d);await sock.sendMessage(from,{text:`✅ Set ${k} = ${d[k]}`,mentions:[sender]});}));
const getvar=mk('getvar','ɢᴇᴛᴠᴀʀ',guard(async({sock,from,sender,text})=>{const d=rc();await sock.sendMessage(from,{text:`🔧 ${text} = ${d[text]||config[text]||'Not set'}`,mentions:[sender]});}));
const delvar=mk('delvar','ᴅᴇʟᴠᴀʀ',guard(async({sock,from,sender,text})=>{const d=rc();delete d[text];wc(d);await sock.sendMessage(from,{text:`✅ Deleted ${text}`,mentions:[sender]});}));
const allvar=mk('allvar','ᴀʟʟᴠᴀʀ',guard(async({sock,from,sender})=>{const d=rc();let t=`🔧 *All Vars*\n\n`;Object.entries(d).forEach(([k,v])=>t+=`${k} = ${v}\n`);await sock.sendMessage(from,{text:t||'No vars',mentions:[sender]});}));
function toggle(name,alias,label){return mk(name,alias,guard(async({sock,from,sender,text})=>{if(!text)return sock.sendMessage(from,{text:`❌ .${name} on/off - current: ${rc()[name]||'off'}`,mentions:[sender]});const d=rc();d[name]=text.toLowerCase()==='on'?'on':'off';wc(d);await sock.sendMessage(from,{text:`✅ ${label} ${d[name]}`,mentions:[sender]});}));}
const readstatus=toggle('readstatus','ʀᴇᴀᴅꜱᴛᴀᴛᴜꜱ','Read Status');
const likestatus=toggle('likestatus','ʟɪᴋᴇꜱᴛᴀᴛᴜꜱ','Like Status');
const startupmsg=toggle('startupmsg','ꜱᴛᴀʀᴛᴜᴘᴍꜱɢ','Startup Msg');
const alwaysonline=toggle('alwaysonline','ᴀʟᴡᴀʏꜱᴏɴʟɪɴᴇ','Always Online');
const antidelete=toggle('antidelete','ᴀɴᴛɪᴅᴇʟᴇᴛᴇ','Anti-Delete');
const antiedit=toggle('antiedit','ᴀɴᴛɪᴇᴅɪᴛ','Anti-Edit');
const antieditchat=toggle('antieditchat','ᴀɴᴛɪᴇᴅɪᴛᴄʜᴀᴛ','Anti-Edit Chat');
const savestatus=toggle('savestatus','ꜱᴀᴠᴇꜱᴛᴀᴛᴜꜱ','Save Status');
const cmdreact=toggle('cmdreact','ᴄᴍᴅʀᴇᴀᴄᴛ','Cmd React');
const readmsg=toggle('readmsg','ʀᴇᴀᴅᴍꜱɢ','Read Msg');
const rejectcall=toggle('rejectcall','ʀᴇᴊᴇᴄᴛᴄᴀʟʟ','Reject Call');
const setsudo=mk('setsudo','ꜱᴇᴛꜱᴜᴅᴏ',guard(async({sock,from,sender,text,msg})=>{const t=msg?.mentionedJid?.[0]||text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';const d=rc();d.sudo=d.sudo||[];if(!d.sudo.includes(t))d.sudo.push(t);wc(d);await sock.sendMessage(from,{text:`✅ Sudo added: @${t.split('@')[0]}`,mentions:[sender,t]});}));
const delsudo=mk('delsudo','ᴅᴇʟꜱᴜᴅᴏ',guard(async({sock,from,sender,text,msg})=>{const t=msg?.mentionedJid?.[0]||text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';const d=rc();d.sudo=(d.sudo||[]).filter(x=>x!==t);wc(d);await sock.sendMessage(from,{text:`✅ Sudo removed`,mentions:[sender]});}));
const getsudo=mk('getsudo','ɢᴇᴛꜱᴜᴅᴏ',guard(async({sock,from,sender})=>{const d=rc();const list=d.sudo||[];let t=`👑 *Sudo List*\n\n`;list.forEach((j,i)=>t+=`${i+1}. @${j.split('@')[0]}\n`);await sock.sendMessage(from,{text:t||'None',mentions:[sender,...list]});}));
const setmod=mk('setmod','ꜱᴇᴛᴍᴏᴅ',guard(async({sock,from,sender,text,msg})=>{const t=msg?.mentionedJid?.[0]||text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';const d=rc();d.mods=d.mods||[];if(!d.mods.includes(t))d.mods.push(t);wc(d);await sock.sendMessage(from,{text:`✅ Mod added: @${t.split('@')[0]}`,mentions:[sender,t]});}));
const delmod=mk('delmod','ᴅᴇʟᴍᴏᴅ',guard(async({sock,from,sender,text,msg})=>{const t=msg?.mentionedJid?.[0]||text.replace(/[^0-9]/g,'')+'@s.whatsapp.net';const d=rc();d.mods=(d.mods||[]).filter(x=>x!==t);wc(d);await sock.sendMessage(from,{text:`✅ Mod removed`,mentions:[sender]});}));
const getmods=mk('getmods','ɢᴇᴛᴍᴏᴅꜱ',guard(async({sock,from,sender})=>{const d=rc();const list=d.mods||[];let t=`🛡️ *Mods*\n\n`;list.forEach((j,i)=>t+=`${i+1}. @${j.split('@')[0]}\n`);await sock.sendMessage(from,{text:t||'None',mentions:[sender,...list]});}));
const mode=mk('mode','ᴍᴏᴅᴇ',guard(async({sock,from,sender,text})=>{if(!['public','private','self'].includes(text.toLowerCase()))return sock.sendMessage(from,{text:`❌ .mode public/private/self`,mentions:[sender]});const d=rc();d.mode=text.toLowerCase();wc(d);await sock.sendMessage(from,{text:`✅ Mode: ${d.mode}`,mentions:[sender]});}));
const statusemoji=mk('statusemoji','ꜱᴛᴀᴛᴜꜱᴇᴍᴏᴊɪ',guard(async({sock,from,sender,text})=>{const d=rc();d.statusEmoji=text||'❤️';wc(d);await sock.sendMessage(from,{text:`✅ Status emoji: ${d.statusEmoji}`,mentions:[sender]});}));
const savecmd=mk('savecmd','ꜱᴀᴠᴇᴄᴍᴅ',guard(async({sock,from,sender,text})=>{const d=rc();d.savecmd=text||'on';wc(d);await sock.sendMessage(from,{text:`✅ SaveCmd: ${d.savecmd}`,mentions:[sender]});}));
const vvcmd=mk('vvcmd','ᴠᴠᴄᴍᴅ',guard(async({sock,from,sender,text})=>{const d=rc();d.vvcmd=text||'on';wc(d);await sock.sendMessage(from,{text:`✅ VV Cmd: ${d.vvcmd}`,mentions:[sender]});}));
module.exports=[setvar,getvar,delvar,allvar,readstatus,likestatus,startupmsg,alwaysonline,antidelete,antiedit,antieditchat,savestatus,cmdreact,readmsg,rejectcall,setsudo,delsudo,getsudo,setmod,delmod,getmods,mode,statusemoji,savecmd,vvcmd];
