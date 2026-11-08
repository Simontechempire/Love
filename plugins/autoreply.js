const fs=require('fs'); const path=require('path');
const f=path.join(__dirname,'../Lib/data/filters.json');
function rf(){try{return JSON.parse(fs.readFileSync(f));}catch{return {personal:{},group:{}};}}function wf(d){if(!fs.existsSync(path.dirname(f)))fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(d,null,2));}
const mk=(n,a,fn)=>({name:n,alias:[a],category:'AUTOREPLY',run:fn});
const pfilter=mk('pfilter','ᴘꜰɪʟᴛᴇʀ',async({sock,from,sender,text})=>{const [word,...rest]=text.split(' ');if(!word||!rest.length)return sock.sendMessage(from,{text:`❌ .pfilter <word> <reply>`,mentions:[sender]});const d=rf();d.personal[word.toLowerCase()]=rest.join(' ');wf(d);await sock.sendMessage(from,{text:`✅ Personal filter: ${word} -> ${rest.join(' ')}`,mentions:[sender]});});
const pstop=mk('pstop','ᴘꜱᴛᴏᴘ',async({sock,from,sender,text})=>{const d=rf();delete d.personal[text.toLowerCase()];wf(d);await sock.sendMessage(from,{text:`✅ Deleted personal filter: ${text}`,mentions:[sender]});});
const gfilter=mk('gfilter','ɢꜰɪʟᴛᴇʀ',async({sock,from,sender,text})=>{if(!from.endsWith('@g.us'))return sock.sendMessage(from,{text:`❌ Group only`,mentions:[sender]});const [word,...rest]=text.split(' ');if(!word||!rest.length)return sock.sendMessage(from,{text:`❌ .gfilter <word> <reply>`,mentions:[sender]});const d=rf();d.group[from]=d.group[from]||{};d.group[from][word.toLowerCase()]=rest.join(' ');wf(d);await sock.sendMessage(from,{text:`✅ Group filter: ${word}`,mentions:[sender]});});
const gstop=mk('gstop','ɢꜱᴛᴏᴘ',async({sock,from,sender,text})=>{const d=rf();if(d.group[from])delete d.group[from][text.toLowerCase()];wf(d);await sock.sendMessage(from,{text:`✅ Deleted group filter: ${text}`,mentions:[sender]});});
module.exports=[pfilter,pstop,gfilter,gstop];
