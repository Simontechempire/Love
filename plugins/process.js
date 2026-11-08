// Plugins/process.js
const mk=(n,a,f)=>({name:n,alias:[a],category:'PROCESS',run:f});
const restart=mk('restart','ʀᴇꜱᴛᴀʀᴛ',async({sock,from,sender})=>{await sock.sendMessage(from,{text:`🔄 Restarting...`,mentions:[sender]});setTimeout(()=>process.exit(0),1000);});
const shutdown=mk('shutdown','ꜱʜᴜᴛᴅᴏᴡɴ',async({sock,from,sender})=>{await sock.sendMessage(from,{text:`🛑 Shutting down...`,mentions:[sender]});setTimeout(()=>process.exit(0),1000);});
const pstatus=mk('p-status','ᴘ-ꜱᴛᴀᴛᴜꜱ',async({sock,from,sender})=>{await sock.sendMessage(from,{text:`🟢 *Process Status*\n\n⏰ Uptime: ${(process.uptime()/3600).toFixed(2)}h\n🧠 RAM: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(0)} MB\n📱 Node: ${process.version}\nPID: ${process.pid}`,mentions:[sender]});});
module.exports=[restart,shutdown,pstatus];
