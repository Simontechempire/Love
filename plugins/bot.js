const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const config = require('../config');

const dataDir = path.join(__dirname, '../Lib/data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const banFile = path.join(dataDir, 'banned.json');
const ignoreFile = path.join(dataDir, 'ignored.json');
const schedFile = path.join(dataDir, 'scheduled.json');

function read(file, def) { try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file)); } catch {} return def; }
function write(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}
function getTarget(msg, args) {
  if (msg?.mentionedJid?.length) return msg.mentionedJid[0];
  if (msg?.quoted?.sender) return msg.quoted.sender;
  if (args[0] && args[0].replace(/[^0-9]/g, '').length >= 8) return args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  return null;
}
function isOwner(sender) {
  const num = sender.split('@')[0];
  return config.ownerNumber?.includes(num) || config.sudo?.includes(num) || sender === config.ownerNumber + '@s.whatsapp.net';
}

const muteUser = {
  name: 'mute-user', alias: ['ᴍᴜᴛᴇ-ᴜꜱᴇʀ'], category: 'BOT',
  run: async ({ sock, from, sender, args, msg }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Tag or reply user. Usage: .mute-user @user`, mentions: [sender] });
    const list = read(ignoreFile, []); if (!list.includes(t)) { list.push(t); write(ignoreFile, list); }
    await sock.sendMessage(from, { text: `🔇 @${t.split('@')[0]} has been muted. Bot go ignore am.`, mentions: [sender, t] });
  }
};
const unmuteUser = {
  name: 'unmute-user', alias: ['ᴜɴᴍᴜᴛᴇ-ᴜꜱᴇʀ'], category: 'BOT',
  run: async ({ sock, from, sender, args, msg }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Tag or reply user.`, mentions: [sender] });
    let list = read(ignoreFile, []); list = list.filter(x => x !== t); write(ignoreFile, list);
    await sock.sendMessage(from, { text: `🔊 @${t.split('@')[0]} unmuted.`, mentions: [sender, t] });
  }
};
const ping = {
  name: 'ping', alias: ['ᴘɪɴɢ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    const start = Date.now();
    const m = await sock.sendMessage(from, { text: `🏓 Pinging...`, mentions: [sender] });
    const latency = Date.now() - start;
    await sock.sendMessage(from, { text: `🏓 *Pong!*\n\n⚡ Speed: ${latency}ms\n⏰ Uptime: ${fmt(process.uptime() * 1000)}`, mentions: [sender] });
  }
};
const ban = {
  name: 'ban', alias: ['ʙᴀɴ'], category: 'BOT',
  run: async ({ sock, from, sender, args, msg }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .ban @user`, mentions: [sender] });
    const list = read(banFile, []); if (!list.includes(t)) { list.push(t); write(banFile, list); }
    await sock.sendMessage(from, { text: `🚫 @${t.split('@')[0]} banned from using bot.`, mentions: [sender, t] });
  }
};
const unban = {
  name: 'unban', alias: ['ᴜɴʙᴀɴ'], category: 'BOT',
  run: async ({ sock, from, sender, args, msg }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .unban @user`, mentions: [sender] });
    let list = read(banFile, []); list = list.filter(x => x !== t); write(banFile, list);
    await sock.sendMessage(from, { text: `✅ @${t.split('@')[0]} unbanned.`, mentions: [sender, t] });
  }
};
const banlist = {
  name: 'banlist', alias: ['ʙᴀɴʟɪꜱᴛ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    const list = read(banFile, []);
    if (!list.length) return sock.sendMessage(from, { text: `✅ No banned users.`, mentions: [sender] });
    const txt = list.map((x, i) => `${i + 1}. @${x.split('@')[0]}`).join('\n');
    await sock.sendMessage(from, { text: `🚫 *Banned List (${list.length})*\n\n${txt}`, mentions: [sender, ...list] });
  }
};
const uptime = {
  name: 'uptime', alias: ['ᴜᴘᴛɪᴍᴇ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    await sock.sendMessage(from, { text: `⏰ *Uptime:* ${fmt(process.uptime() * 1000)}`, mentions: [sender] });
  }
};
const runtime = {
  name: 'runtime', alias: ['ʀᴜɴᴛɪᴍᴇ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    const mem = process.memoryUsage();
    await sock.sendMessage(from, { text: `⏱️ *Runtime:* ${fmt(process.uptime() * 1000)}\n🧠 RAM: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n💻 Platform: ${os.platform()} ${os.arch()}\n🖥️ CPU: ${os.cpus()[0].model}`, mentions: [sender] });
  }
};
const stats = {
  name: 'stats', alias: ['ꜱᴛᴀᴛꜱ'], category: 'BOT',
  run: async ({ sock, from, sender, plugins }) => {
    const mem = process.memoryUsage();
    await sock.sendMessage(from, { text: `◈┈▉ *Love Stats* ▉┄◈\n\n📦 Plugins: ${(plugins || []).length}\n⏰ Uptime: ${fmt(process.uptime() * 1000)}\n🧠 RAM: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\n💻 Platform: ${os.platform()}\n📱 Node: ${process.version}\n👤 Owner: ${config.ownerName}`, mentions: [sender] });
  }
};
const owner = {
  name: 'owner', alias: ['ᴏᴡɴᴇʀ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    const num = config.ownerNumber;
    await sock.sendMessage(from, { text: `👑 *Owner:* ${config.ownerName}\n📞 Number: +${num}`, mentions: [sender] });
    try { await sock.sendMessage(from, { contacts: { displayName: config.ownerName, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.ownerName}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD` }] } }); } catch {}
  }
};
const repo = {
  name: 'repo', alias: ['ʀᴇᴘᴏ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    await sock.sendMessage(from, { text: `◈┈▉ *Love Repo* ▉┄◈\n\n🔗 Repo: ${config.repo || 'https://github.com/SimonTech/Love'}\n👑 Owner: ${config.ownerName}\n⭐ Star the repo to support!`, mentions: [sender] });
  }
};
const update = {
  name: 'update', alias: ['ᴜᴘᴅᴀᴛᴇ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    await sock.sendMessage(from, { text: `🔄 Updating from GitHub...`, mentions: [sender] });
    exec('git pull', (err, stdout, stderr) => {
      if (err) return sock.sendMessage(from, { text: `❌ Update failed: ${err.message}\n${stderr}`, mentions: [sender] });
      sock.sendMessage(from, { text: `✅ *Update Done*\n\n\`\`\`\n${stdout}\n\`\`\`\n\nRestart bot to apply: .restart`, mentions: [sender] });
    });
  }
};
const ignore = {
  name: 'ignore', alias: ['ɪɢɴᴏʀᴇ'], category: 'BOT',
  run: async ({ sock, from, sender, args }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    // .ignore <chat> - ignore current chat
    const target = from;
    const list = read(ignoreFile, []);
    // We store chats separately - use same file with prefix
    const key = `chat:${target}`;
    if (!list.includes(key)) { list.push(key); write(ignoreFile, list); }
    await sock.sendMessage(from, { text: `🔇 This chat will now be ignored by bot. Use .allow to un-ignore.`, mentions: [sender] });
  }
};
const allow = {
  name: 'allow', alias: ['ᴀʟʟᴏᴡ'], category: 'BOT',
  run: async ({ sock, from, sender }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    let list = read(ignoreFile, []); list = list.filter(x => x !== `chat:${from}`); write(ignoreFile, list);
    await sock.sendMessage(from, { text: `✅ This chat is now allowed again.`, mentions: [sender] });
  }
};
const botCmd = {
  name: 'bot', alias: ['ʙᴏᴛ'], category: 'BOT',
  run: async ({ sock, from, sender, pushName }) => {
    await sock.sendMessage(from, { text: `🤖 *Love Bot is online!*\n\n👋 Hi ${pushName}\n⏰ Uptime: ${fmt(process.uptime() * 1000)}\n👑 Owner: ${config.ownerName}\n\nType .menu to see commands.`, mentions: [sender] });
  }
};
const schdlcmd = {
  name: 'schdlcmd', alias: ['ꜱᴄʜᴅʟᴄᴍᴅ'], category: 'BOT',
  run: async ({ sock, from, sender, text }) => {
    if (!isOwner(sender)) return sock.sendMessage(from, { text: `❌ Owner only.`, mentions: [sender] });
    // Usage: .schdlcmd 60 .menu  |  .schdlcmd list  |  .schdlcmd del <id>
    if (!text) return sock.sendMessage(from, { text: `❌ Usage:\n.schdlcmd <seconds> <command>\nExample: .schdlcmd 60 .ping\n.schdlcmd list\n.schdlcmd del <id>`, mentions: [sender] });
    const list = read(schedFile, []);
    if (text.toLowerCase() === 'list') {
      if (!list.length) return sock.sendMessage(from, { text: `📅 No scheduled commands.`, mentions: [sender] });
      const t = list.map((s, i) => `${i}. In ${Math.max(0, Math.round((s.at - Date.now()) / 1000))}s -> ${s.cmd} in ${s.chat}`).join('\n');
      return sock.sendMessage(from, { text: `📅 *Scheduled*\n\n${t}`, mentions: [sender] });
    }
    if (text.toLowerCase().startsWith('del ')) {
      const idx = parseInt(text.split(' ')[1]);
      if (isNaN(idx) || !list[idx]) return sock.sendMessage(from, { text: `❌ Invalid id.`, mentions: [sender] });
      list.splice(idx, 1); write(schedFile, list);
      return sock.sendMessage(from, { text: `✅ Deleted scheduled #${idx}`, mentions: [sender] });
    }
    const parts = text.split(' ');
    const secs = parseInt(parts[0]);
    const cmd = parts.slice(1).join(' ');
    if (isNaN(secs) || !cmd) return sock.sendMessage(from, { text: `❌ Usage: .schdlcmd 60 .ping`, mentions: [sender] });
    const job = { at: Date.now() + secs * 1000, cmd, chat: from, id: Date.now() };
    list.push(job); write(schedFile, list);
    // Real timer - sends reminder when time reaches
    setTimeout(async () => {
      try { await sock.sendMessage(from, { text: `⏰ *Scheduled Command*\n\nTime reached for: ${cmd}\n\nRun am now: ${cmd}`, mentions: [sender] }); } catch {}
      const cur = read(schedFile, []).filter(x => x.id !== job.id); write(schedFile, cur);
    }, secs * 1000);
    await sock.sendMessage(from, { text: `✅ Scheduled: \`${cmd}\` in ${secs}s in this chat.`, mentions: [sender] });
  }
};

module.exports = [muteUser, unmuteUser, ping, ban, unban, banlist, uptime, runtime, stats, owner, repo, update, ignore, allow, botCmd, schdlcmd];
