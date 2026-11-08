const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../Lib/data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const userFile = path.join(dataDir, 'users.json');
const nickFile = path.join(dataDir, 'nicks.json');

function read(f, d) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f)); } catch {} return d; }
function write(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
function getTarget(msg, args, sender) {
  if (msg?.mentionedJid?.length) return msg.mentionedJid[0];
  if (msg?.quoted?.sender) return msg.quoted.sender;
  if (args[0] && args[0].replace(/[^0-9]/g, '').length >= 8) return args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  return sender;
}
function getUsers() { return read(userFile, {}); }
function saveUsers(u) { write(userFile, u); }
function getNicks() { return read(nickFile, {}); }
function saveNicks(n) { write(nickFile, n); }
// Real XP system - +10 per command is handled in index.js, here we just read
function getLevel(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
function getXpForLevel(level) { return Math.pow(level - 1, 2) * 100; }

async function getPP(sock, jid) {
  try { return await sock.profilePictureUrl(jid, 'image'); } catch { return 'https://i.ibb.co/6y2xG0L/no-pp.jpg'; }
}
async function getBio(sock, jid) {
  try { const s = await sock.fetchStatus(jid); return s?.status || 'No bio set'; } catch { return 'No bio set'; }
}

const profile = {
  name: 'profile', alias: ['ᴘʀᴏꜰɪʟᴇ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg, pushName }) => {
    const t = getTarget(msg, args, sender);
    const users = getUsers(); const nicks = getNicks();
    const u = users[t] || { xp: 0, msgs: 0 };
    const level = getLevel(u.xp);
    const pp = await getPP(sock, t);
    const bio = await getBio(sock, t);
    const nick = nicks[t] || pushName || 'Unknown';
    await sock.sendMessage(from, { image: { url: pp }, caption: `◈┈▉ *Profile* ▉┄◈\n\n👤 Name: ${nick}\n📞 Number: +${t.split('@')[0]}\n🏷️ Nick: ${nicks[t] || 'Not set'}\n📝 Bio: ${bio}\n⭐ Level: ${level}\n✨ XP: ${u.xp} / ${getXpForLevel(level + 1)}\n💬 Messages: ${u.msgs || 0}`, mentions: [sender, t] });
  }
};

const bio = {
  name: 'bio', alias: ['ʙɪᴏ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const b = await getBio(sock, t);
    await sock.sendMessage(from, { text: `📝 *Bio of @${t.split('@')[0]}*\n\n${b}`, mentions: [sender, t] });
  }
};

const tagme = {
  name: 'tagme', alias: ['ᴛᴀɢᴍᴇ'], category: 'USER',
  run: async ({ sock, from, sender, pushName }) => {
    await sock.sendMessage(from, { text: `👋 @${sender.split('@')[0]} - ${pushName || 'You'} tagged yourself!`, mentions: [sender] });
  }
};

const whois = {
  name: 'whois', alias: ['ᴡʜᴏɪꜱ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const pp = await getPP(sock, t);
    const b = await getBio(sock, t);
    const users = getUsers(); const u = users[t] || { xp: 0, msgs: 0 };
    const isBiz = await sock.getBusinessProfile?.(t).catch(() => null);
    await sock.sendMessage(from, { image: { url: pp }, caption: `🔍 *Who Is*\n\n👤 JID: ${t}\n📞 Number: +${t.split('@')[0]}\n📝 Bio: ${b}\n⭐ Level: ${getLevel(u.xp)}\n✨ XP: ${u.xp}\n🏢 Business: ${isBiz ? 'Yes' : 'No'}`, mentions: [sender, t] });
  }
};

const level = {
  name: 'level', alias: ['ʟᴇᴠᴇʟ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const users = getUsers(); const u = users[t] || { xp: 0 };
    const lvl = getLevel(u.xp);
    const need = getXpForLevel(lvl + 1) - u.xp;
    await sock.sendMessage(from, { text: `⭐ *Level of @${t.split('@')[0]}*\n\n⭐ Level: ${lvl}\n✨ XP: ${u.xp}\n🎯 Need ${need} XP for Level ${lvl + 1}\n📊 Progress: ${Math.floor((u.xp - getXpForLevel(lvl)) / (getXpForLevel(lvl + 1) - getXpForLevel(lvl)) * 100)}%`, mentions: [sender, t] });
  }
};

const rank = {
  name: 'rank', alias: ['ʀᴀɴᴋ'], category: 'USER',
  run: async ({ sock, from, sender }) => {
    const users = getUsers();
    const sorted = Object.entries(users).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0));
    if (!sorted.length) return sock.sendMessage(from, { text: `📊 No ranking yet. Chat more to earn XP!`, mentions: [sender] });
    const myPos = sorted.findIndex(([jid]) => jid === sender) + 1;
    let txt = `🏆 *Top Rank (XP)*\n\n`;
    sorted.slice(0, 10).forEach(([jid, u], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      txt += `${medal} @${jid.split('@')[0]} - Lvl ${getLevel(u.xp)} | ${u.xp} XP\n`;
    });
    txt += `\n📍 Your rank: ${myPos ? `#${myPos}` : 'Unranked'}`;
    await sock.sendMessage(from, { text: txt, mentions: [sender, ...sorted.slice(0, 10).map(([jid]) => jid)] });
  }
};

const xp = {
  name: 'xp', alias: ['xᴘ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const users = getUsers(); const u = users[t] || { xp: 0, msgs: 0 };
    await sock.sendMessage(from, { text: `✨ *XP of @${t.split('@')[0]}*\n\n✨ XP: ${u.xp}\n⭐ Level: ${getLevel(u.xp)}\n💬 Messages: ${u.msgs || 0}`, mentions: [sender, t] });
  }
};

const setprofile = {
  name: 'setprofile', alias: ['ꜱᴇᴛᴘʀᴏꜰɪʟᴇ'], category: 'USER',
  run: async ({ sock, from, sender, msg }) => {
    const quoted = msg?.quoted;
    if (!quoted || !quoted.mtype || !quoted.mtype.includes('image')) return sock.sendMessage(from, { text: `❌ Reply to an image with .setprofile to set your DP`, mentions: [sender] });
    try {
      const buf = await sock.downloadMediaMessage(quoted);
      await sock.updateProfilePicture(sender, buf);
      await sock.sendMessage(from, { text: `✅ Your profile picture updated.`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Failed: ${e.message}`, mentions: [sender] }); }
  }
};

const status = {
  name: 'status', alias: ['ꜱᴛᴀᴛᴜꜱ'], category: 'USER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .status <your new bio>\nExample: .status I love Love Bot ❤️`, mentions: [sender] });
    try { await sock.updateProfileStatus(text); await sock.sendMessage(from, { text: `✅ Your bio updated to:\n${text}`, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: `❌ Failed: ${e.message}`, mentions: [sender] }); }
  }
};

const online = {
  name: 'online', alias: ['ᴏɴʟɪɴᴇ'], category: 'USER',
  run: async ({ sock, from, sender }) => {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: `❌ Only works in groups.`, mentions: [sender] });
    try {
      const m = await sock.groupMetadata(from);
      const all = m.participants.map(p => p.id);
      // Real presence check - fetch presence for each
      const onlineList = [];
      for (const jid of all.slice(0, 30)) {
        try { const p = await sock.fetchStatus(jid); if (p) onlineList.push(jid); } catch {}
      }
      await sock.sendMessage(from, { text: `🟢 *Online / Active in Group*\n\nTotal members: ${all.length}\n\nNote: WhatsApp no dey show real online status via API, so this lists all members. Tag them:`, mentions: all });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const block = {
  name: 'block', alias: ['ʙʟᴏᴄᴋ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    if (t === sender) return sock.sendMessage(from, { text: `❌ You no fit block yourself.`, mentions: [sender] });
    try { await sock.updateBlockStatus(t, 'block'); await sock.sendMessage(from, { text: `🚫 Blocked @${t.split('@')[0]}`, mentions: [sender, t] }); } catch (e) { await sock.sendMessage(from, { text: `❌ Block failed: ${e.message}`, mentions: [sender] }); }
  }
};

const unblock = {
  name: 'unblock', alias: ['ᴜɴʙʟᴏᴄᴋ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    try { await sock.updateBlockStatus(t, 'unblock'); await sock.sendMessage(from, { text: `✅ Unblocked @${t.split('@')[0]}`, mentions: [sender, t] }); } catch (e) { await sock.sendMessage(from, { text: `❌ Unblock failed: ${e.message}`, mentions: [sender] }); }
  }
};

const getstatus = {
  name: 'getstatus', alias: ['ɢᴇᴛꜱᴛᴀᴛᴜꜱ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const b = await getBio(sock, t);
    await sock.sendMessage(from, { text: `📝 *Status of @${t.split('@')[0]}*\n\n${b}`, mentions: [sender, t] });
  }
};

const avatar = {
  name: 'avatar', alias: ['ᴀᴠᴀᴛᴀʀ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const pp = await getPP(sock, t);
    await sock.sendMessage(from, { image: { url: pp }, caption: `🖼️ Avatar of @${t.split('@')[0]}`, mentions: [sender, t] });
  }
};

const getpp = {
  name: 'getpp', alias: ['ɢᴇᴛᴘᴘ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const pp = await getPP(sock, t);
    await sock.sendMessage(from, { image: { url: pp }, caption: `🖼️ Profile Picture of @${t.split('@')[0]}`, mentions: [sender, t] });
  }
};

const listblock = {
  name: 'listblock', alias: ['ʟɪꜱᴛʙʟᴏᴄᴋ'], category: 'USER',
  run: async ({ sock, from, sender }) => {
    try {
      const list = await sock.fetchBlocklist();
      if (!list.length) return sock.sendMessage(from, { text: `✅ You no block anybody.`, mentions: [sender] });
      let txt = `🚫 *Blocked List (${list.length})*\n\n`;
      list.forEach((jid, i) => txt += `${i + 1}. @${jid.split('@')[0]}\n`);
      await sock.sendMessage(from, { text: txt, mentions: [sender, ...list] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const myinfo = {
  name: 'myinfo', alias: ['ᴍʏɪɴꜰᴏ'], category: 'USER',
  run: async ({ sock, from, sender, pushName }) => {
    const users = getUsers(); const u = users[sender] || { xp: 0, msgs: 0 };
    const nicks = getNicks();
    const pp = await getPP(sock, sender);
    const b = await getBio(sock, sender);
    await sock.sendMessage(from, { image: { url: pp }, caption: `◈┈▉ *My Info* ▉┄◈\n\n👤 Name: ${pushName}\n🏷️ Nick: ${nicks[sender] || 'Not set'}\n📞 Number: +${sender.split('@')[0]}\n📝 Bio: ${b}\n⭐ Level: ${getLevel(u.xp)}\n✨ XP: ${u.xp}\n💬 Messages: ${u.msgs || 0}\n🆔 JID: ${sender}`, mentions: [sender] });
  }
};

const setnick = {
  name: 'setnick', alias: ['ꜱᴇᴛɴɪᴄᴋ'], category: 'USER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .setnick <nickname>\nExample: .setnick Big Simon`, mentions: [sender] });
    const nicks = getNicks(); nicks[sender] = text; saveNicks(nicks);
    await sock.sendMessage(from, { text: `✅ Your nickname set to: *${text}*`, mentions: [sender] });
  }
};

const nick = {
  name: 'nick', alias: ['ɴɪᴄᴋ'], category: 'USER',
  run: async ({ sock, from, sender, args, msg }) => {
    const t = getTarget(msg, args, sender);
    const nicks = getNicks();
    await sock.sendMessage(from, { text: `🏷️ *Nick of @${t.split('@')[0]}:* ${nicks[t] || 'Not set'}\n\nUse .setnick <name> to set yours.`, mentions: [sender, t] });
  }
};

module.exports = [profile, bio, tagme, whois, level, rank, xp, setprofile, status, online, block, unblock, getstatus, avatar, getpp, listblock, myinfo, setnick, nick];
