const fs=require('fs'); const path=require('path');
const mk=(n,a,f)=>({name:n,alias:[a],category:'PLUGINS',run:f});
const plugin=mk('plugin','ᴘʟᴜɢɪɴ',async({sock,from,sender,text,plugins})=>{
  if(!text) return sock.sendMessage(from,{text:`❌ .plugin <name> to see plugin info`,mentions:[sender]});
  const p=plugins.find(x=>x.name===text.toLowerCase()||x.alias?.includes(text));
  if(!p) return sock.sendMessage(from,{text:`❌ Plugin not found`,mentions:[sender]});
  await sock.sendMessage(from,{text:`🔌 *Plugin: ${p.name}*\n\nCategory: ${p.category}\nAlias: ${p.alias?.join(', ')||'none'}`,mentions:[sender]});
});
const remove=mk('remove','ʀᴇᴍᴏᴠᴇ',async({sock,from,sender,text})=>{
  if(!text) return sock.sendMessage(from,{text:`❌ .remove <plugin file name>`,mentions:[sender]});
  const file=path.join(__dirname,`./${text}.js`);
  if(!fs.existsSync(file)) return sock.sendMessage(from,{text:`❌ File not found: Plugins/${text}.js`,mentions:[sender]});
  fs.unlinkSync(file);
  await sock.sendMessage(from,{text:`✅ Removed Plugins/${text}.js - restart bot to apply`,mentions:[sender]});
});
const pluginsCmd=mk('plugins','ᴘʟᴜɢɪɴꜱ',async({sock,from,sender,plugins})=>{
  const cats={}; plugins.forEach(p=>{cats[p.category]=(cats[p.category]||0)+1;});
  let t=`🔌 *Plugins (${plugins.length})*\n\n`;
  Object.entries(cats).forEach(([c,n])=>t+=`• ${c}: ${n}\n`);
  await sock.sendMessage(from,{text:t,mentions:[sender]});
});
module.exports=[plugin,remove,pluginsCmd];
