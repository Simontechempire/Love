const os = require('os');
const config = require('../config');
function fmt(ms){const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);return `${d}d ${h}h ${m}m ${s%60}s`;}
function menuText(plugins, sender, pushName, filter){
  const cats = {};
  plugins.forEach(p=>{ if(filter && p.category.toLowerCase()!==filter.toLowerCase()) return; (cats[p.category]=cats[p.category]||[]).push(p); });
  let t = `◈┈▉ \`Love\` ▉┄◈\n> ╭────↯\n> │ ➠ *Owner:* ${config.ownerName}\n> │ ➠ *User:* @${sender.split('@')[0]}\n> │ ➠ *Plugins:* ${plugins.length}\n> │ ➠ *Uptime:* ${fmt(process.uptime()*1000)}\n> │ ➠ *Memory:* ${(process.memoryUsage().heapUsed/1024/1024).toFixed(0)} MB / ${(os.totalmem()/1024/1024/1024).toFixed(0)} GB\n> │ ➠ *Version:* ${config.version||'1.0.0'}\n> │ ➠ *Platform:* ${os.platform()}\n> ╰────↯\n\n`;
  for(const [cat, list] of Object.entries(cats)){
    t += `╭──────────◈\n┆ ◈ *${cat}*\n`;
    list.forEach(p=> t+=`┆ ◈ .${p.alias?.[0]||p.name}\n`);
    t += `╰──────────◈\n\n`;
  }
  t += `> 💡 Tip: Use menu [category] for specific commands.\n\n◈┈▉ *~*_Love_*~* ▉┄◈`;
  return t;
}
const menu = { name:'menu', alias:['ᴍᴇɴᴜ'], category:'HELP', run: async({sock,from,sender,text,plugins,pushName})=>{ await sock.sendMessage(from,{text:menuText(plugins,sender,pushName,text), mentions:[sender]}); }};
const list = { name:'list', alias:['ʟɪꜱᴛ'], category:'HELP', run: async({sock,from,sender,text,plugins,pushName})=>{ await sock.sendMessage(from,{text:menuText(plugins,sender,pushName,text), mentions:[sender]}); }};
module.exports=[menu,list];
