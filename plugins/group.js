const fs = require('fs');
const path = require('path');
const config = require('../config');

const dataDir = path.join(__dirname, '../Lib/data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const warnFile = path.join(dataDir, 'warns.json');
const settingsFile = path.join(dataDir, 'group-settings.json');

function read(f, d) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f)); } catch {} return d; }
function write(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
function getSettings() { return read(settingsFile, {}); }
function saveSettings(s) { write(settingsFile, s); }
function getTarget(msg, args) {
  if (msg?.mentionedJid?.length) return msg.mentionedJid[0];
  if (msg?.quoted?.sender) return msg.quoted.sender;
  if (args[0] && args[0].replace(/[^0-9]/g, '').length >= 8) return args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  return null;
}
async function isAdmin(sock, from, sender) {
  try { const m = await sock.groupMetadata(from); const p = m.participants.find(x => x.id === sender); return p?.admin === 'admin' || p?.admin === 'superadmin'; } catch { return false; }
}
async function isBotAdmin(sock, from) {
  try { const m = await sock.groupMetadata(from); const me = sock.user.id.split(':')[0] + '@s.whatsapp.net'; const p = m.participants.find(x => x.id === me || x.id === sock.user.id); return p?.admin === 'admin' || p?.admin === 'superadmin'; } catch { return false; }
}
function needGroup(from, sock, sender) { if (!from.endsWith('@g.us')) { sock.sendMessage(from, { text: `❌ This command only works in groups.`, mentions: [sender] }); return false; } return true; }

const join = { name: 'join', alias: ['ᴊᴏɪɴ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!text) return sock.sendMessage(from, { text: `❌ Usage: .join <group invite link>`, mentions: [sender] });
  const code = text.split('/').pop().split('?')[0];
  try { const id = await sock.groupAcceptInvite(code); await sock.sendMessage(from, { text: `✅ Joined group: ${id}`, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: `❌ Join failed: ${e.message}`, mentions: [sender] }); }
}};
const leave = { name: 'leave', alias: ['ʟᴇᴀᴠᴇ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  await sock.sendMessage(from, { text: `👋 Bye! Leaving group...`, mentions: [sender] });
  await sock.groupLeave(from);
}};
const gpp = { name: 'gpp', alias: ['ɢᴘᴘ'], category: 'GROUP', run: async ({ sock, from, sender, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const quoted = msg?.quoted; if (!quoted || !quoted.mtype || !quoted.mtype.includes('image')) return sock.sendMessage(from, { text: `❌ Reply to an image with .gpp`, mentions: [sender] });
  try { const buf = await sock.downloadMediaMessage(quoted); await sock.updateProfilePicture(from, buf); await sock.sendMessage(from, { text: `✅ Group picture updated.`, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const gname = { name: 'gname', alias: ['ɢɴᴀᴍᴇ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  if (!text) return sock.sendMessage(from, { text: `❌ Usage: .gname <new name>`, mentions: [sender] });
  await sock.groupUpdateSubject(from, text); await sock.sendMessage(from, { text: `✅ Group name changed to: ${text}`, mentions: [sender] });
}};
const gdesc = { name: 'gdesc', alias: ['ɢᴅᴇꜱᴄ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  if (!text) return sock.sendMessage(from, { text: `❌ Usage: .gdesc <new description>`, mentions: [sender] });
  await sock.groupUpdateDescription(from, text); await sock.sendMessage(from, { text: `✅ Group description updated.`, mentions: [sender] });
}};
const add = { name: 'add', alias: ['ᴀᴅᴅ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  if (!await isBotAdmin(sock, from)) return sock.sendMessage(from, { text: `❌ Bot must be admin.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .add 234... / tag user`, mentions: [sender] });
  try { await sock.groupParticipantsUpdate(from, [t], 'add'); await sock.sendMessage(from, { text: `✅ Added @${t.split('@')[0]}`, mentions: [sender, t] }); } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const kick = { name: 'kick', alias: ['ᴋɪᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  if (!await isBotAdmin(sock, from)) return sock.sendMessage(from, { text: `❌ Bot must be admin.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .kick @user`, mentions: [sender] });
  await sock.groupParticipantsUpdate(from, [t], 'remove'); await sock.sendMessage(from, { text: `👢 Kicked @${t.split('@')[0]}`, mentions: [sender, t] });
}};
const tkick = { name: 'tkick', alias: ['ᴛᴋɪᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); const secs = parseInt(args[1] || args[0]?.match?.(/\d+/)?.[0] || '60');
  if (!t) return sock.sendMessage(from, { text: `❌ Usage: .tkick @user 60 (seconds)`, mentions: [sender] });
  await sock.groupParticipantsUpdate(from, [t], 'remove');
  await sock.sendMessage(from, { text: `👢 @${t.split('@')[0]} kicked for ${secs}s. Will be re-added after.`, mentions: [sender, t] });
  setTimeout(async () => { try { await sock.groupParticipantsUpdate(from, [t], 'add'); await sock.sendMessage(from, { text: `✅ @${t.split('@')[0]} re-added after temp kick.`, mentions: [t] }); } catch {} }, secs * 1000);
}};
const promote = { name: 'promote', alias: ['ᴘʀᴏᴍᴏᴛᴇ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .promote @user`, mentions: [sender] });
  await sock.groupParticipantsUpdate(from, [t], 'promote'); await sock.sendMessage(from, { text: `⬆️ Promoted @${t.split('@')[0]} to admin.`, mentions: [sender, t] });
}};
const demote = { name: 'demote', alias: ['ᴅᴇᴍᴏᴛᴇ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .demote @user`, mentions: [sender] });
  await sock.groupParticipantsUpdate(from, [t], 'demote'); await sock.sendMessage(from, { text: `⬇️ Demoted @${t.split('@')[0]}.`, mentions: [sender, t] });
}};
const mute = { name: 'mute', alias: ['ᴍᴜᴛᴇ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  await sock.groupSettingUpdate(from, 'announcement'); await sock.sendMessage(from, { text: `🔇 Group muted - only admins can send.`, mentions: [sender] });
}};
const unmute = { name: 'unmute', alias: ['ᴜɴᴍᴜᴛᴇ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  await sock.groupSettingUpdate(from, 'not_announcement'); await sock.sendMessage(from, { text: `🔊 Group unmuted.`, mentions: [sender] });
}};
const invite = { name: 'invite', alias: ['ɪɴᴠɪᴛᴇ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  const code = await sock.groupInviteCode(from);
  await sock.sendMessage(from, { text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}`, mentions: [sender] });
}};
const revoke = { name: 'revoke', alias: ['ʀᴇᴠᴏᴋᴇ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const code = await sock.groupRevokeInvite(from); await sock.sendMessage(from, { text: `✅ Invite revoked.\nNew link: https://chat.whatsapp.com/${code}`, mentions: [sender] });
}};
const tag = { name: 'tag', alias: ['ᴛᴀɢ'], category: 'GROUP', run: async ({ sock, from, sender, text, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  const m = await sock.groupMetadata(from); const all = m.participants.map(p => p.id);
  const t = text || msg?.quoted?.text || 'Attention everyone!';
  await sock.sendMessage(from, { text: `📢 *Tag*\n\n${t}`, mentions: all });
}};
const tagall = { name: 'tagall', alias: ['ᴛᴀɢᴀʟʟ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const m = await sock.groupMetadata(from); const all = m.participants.map(p => p.id);
  let txt = `📢 *Tag All (${all.length})*\n\n${text || 'Hello everyone!'}\n\n`;
  all.forEach((id, i) => txt += `${i + 1}. @${id.split('@')[0]}\n`);
  await sock.sendMessage(from, { text: txt, mentions: all });
}};
const all = { name: 'all', alias: ['ᴀʟʟ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  const m = await sock.groupMetadata(from); const allIds = m.participants.map(p => p.id);
  await sock.sendMessage(from, { text: text || '👥 Everyone!', mentions: allIds });
}};
const creategc = { name: 'creategc', alias: ['ᴄʀᴇᴀᴛᴇɢᴄ'], category: 'GROUP', run: async ({ sock, from, sender, text, args, msg }) => {
  if (!text) return sock.sendMessage(from, { text: `❌ Usage: .creategc <name>`, mentions: [sender] });
  const parts = msg?.mentionedJid?.length ? msg.mentionedJid : [];
  try { const g = await sock.groupCreate(text, parts); await sock.sendMessage(from, { text: `✅ Group created: ${text}\nID: ${g.id}`, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const lock = { name: 'lock', alias: ['ʟᴏᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  await sock.groupSettingUpdate(from, 'locked'); await sock.sendMessage(from, { text: `🔒 Group info locked - only admins can edit.`, mentions: [sender] });
}};
const unlock = { name: 'unlock', alias: ['ᴜɴʟᴏᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  await sock.groupSettingUpdate(from, 'unlocked'); await sock.sendMessage(from, { text: `🔓 Group info unlocked.`, mentions: [sender] });
}};
const ginfo = { name: 'ginfo', alias: ['ɢɪɴꜰᴏ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  const m = await sock.groupMetadata(from);
  const admins = m.participants.filter(p => p.admin).map(p => `@${p.id.split('@')[0]}`).join(', ');
  await sock.sendMessage(from, { text: `◈┈▉ *Group Info* ▉┄◈\n\n📛 Name: ${m.subject}\n🆔 ID: ${m.id}\n👥 Members: ${m.participants.length}\n👑 Admins: ${admins}\n📝 Desc: ${m.desc || 'No description'}\n📅 Created: ${new Date(m.creation * 1000).toLocaleString()}`, mentions: [sender, ...m.participants.map(p => p.id)] });
}};
const events = { name: 'events', alias: ['ᴇᴠᴇɴᴛꜱ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  const s = getSettings(); const cur = s[from]?.events || 'off';
  if (!text) return sock.sendMessage(from, { text: `📅 Group events: ${cur}\nUsage: .events on / off`, mentions: [sender] });
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  s[from] = { ...s[from], events: text.toLowerCase() === 'on' ? 'on' : 'off' }; saveSettings(s);
  await sock.sendMessage(from, { text: `✅ Events ${s[from].events}`, mentions: [sender] });
}};
function toggleSetting(name) {
  return { name, alias: [], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
    if (!needGroup(from, sock, sender)) return;
    if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
    const s = getSettings(); const cur = s[from]?.[name] || 'off';
    if (!text) return sock.sendMessage(from, { text: `🛡️ ${name}: ${cur}\nUsage: .${name} on / off`, mentions: [sender] });
    s[from] = { ...s[from], [name]: text.toLowerCase() === 'on' ? 'on' : 'off' }; saveSettings(s);
    await sock.sendMessage(from, { text: `✅ ${name} ${s[from][name]}`, mentions: [sender] });
  }};
}
const antilink = toggleSetting('antilink');
const akick = { name: 'akick', alias: ['ᴀᴋɪᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const s = getSettings(); const cur = s[from]?.akick || 'off';
  if (!text) return sock.sendMessage(from, { text: `🦶 Auto-kick: ${cur}\nUsage: .akick on / off`, mentions: [sender] });
  s[from] = { ...s[from], akick: text.toLowerCase() === 'on' ? 'on' : 'off' }; saveSettings(s);
  await sock.sendMessage(from, { text: `✅ Auto-kick ${s[from].akick}`, mentions: [sender] });
}};
const antiword = { name: 'antiword', alias: ['ᴀɴᴛɪᴡᴏʀᴅ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const s = getSettings(); const words = s[from]?.antiwords || [];
  if (!text) return sock.sendMessage(from, { text: `🚫 Blocked words: ${words.join(', ') || 'none'}\nUsage: .antiword add <word> | .antiword del <word> | .antiword on/off`, mentions: [sender] });
  if (text.startsWith('add ')) { const w = text.slice(4).trim().toLowerCase(); if (!words.includes(w)) words.push(w); s[from] = { ...s[from], antiwords: words, antiword: 'on' }; saveSettings(s); return sock.sendMessage(from, { text: `✅ Added blocked word: ${w}`, mentions: [sender] }); }
  if (text.startsWith('del ')) { const w = text.slice(4).trim().toLowerCase(); s[from] = { ...s[from], antiwords: words.filter(x => x !== w) }; saveSettings(s); return sock.sendMessage(from, { text: `✅ Removed: ${w}`, mentions: [sender] }); }
  if (text === 'on' || text === 'off') { s[from] = { ...s[from], antiword: text }; saveSettings(s); return sock.sendMessage(from, { text: `✅ Antiword ${text}`, mentions: [sender] }); }
  await sock.sendMessage(from, { text: `❌ Usage: .antiword add <word>`, mentions: [sender] });
}};
const warn = { name: 'warn', alias: ['ᴡᴀʀɴ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg, text }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .warn @user <reason>`, mentions: [sender] });
  const warns = read(warnFile, {}); const key = `${from}:${t}`; warns[key] = (warns[key] || 0) + 1; write(warnFile, warns);
  const reason = args.slice(1).join(' ') || 'No reason';
  await sock.sendMessage(from, { text: `⚠️ Warn ${warns[key]}/3\n@${t.split('@')[0]} warned for: ${reason}`, mentions: [sender, t] });
  if (warns[key] >= 3) {
    if (await isBotAdmin(sock, from)) await sock.groupParticipantsUpdate(from, [t], 'remove');
    delete warns[key]; write(warnFile, warns);
    await sock.sendMessage(from, { text: `👢 @${t.split('@')[0]} kicked after 3 warns.`, mentions: [t] });
  }
}};
const antigm = toggleSetting('antigm');
const antigcstatus = toggleSetting('antigcstatus');
const antibot = toggleSetting('antibot');
const antispam = toggleSetting('antispam');
const antitag = toggleSetting('antitag');
const reset = { name: 'reset', alias: ['ʀᴇꜱᴇᴛ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const s = getSettings(); delete s[from]; saveSettings(s);
  await sock.sendMessage(from, { text: `✅ All group settings reset.`, mentions: [sender] });
}};
const kickr = { name: 'kickr', alias: ['ᴋɪᴄᴋʀ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  if (!await isBotAdmin(sock, from)) return sock.sendMessage(from, { text: `❌ Bot must be admin.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .kickr @user (kick + remove from recent)`, mentions: [sender] });
  await sock.groupParticipantsUpdate(from, [t], 'remove');
  await sock.sendMessage(from, { text: `👢 @${t.split('@')[0]} kicked (kickr).`, mentions: [sender, t] });
}};
const gcstatus = { name: 'gcstatus', alias: ['ɢᴄꜱᴛᴀᴛᴜꜱ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  const s = getSettings()[from] || {};
  const keys = ['antilink','akick','antiword','antigm','antigcstatus','antibot','antispam','antitag','events'];
  let txt = `◈┈▉ *Group Settings* ▉┄◈\n\n`;
  keys.forEach(k => txt += `${s[k] === 'on' ? '✅' : '❌'} ${k}: ${s[k] || 'off'}\n`);
  if (s.antiwords?.length) txt += `\n🚫 Words: ${s.antiwords.join(', ')}`;
  await sock.sendMessage(from, { text: txt, mentions: [sender] });
}};
const listrequest = { name: 'listrequest', alias: ['ʟɪꜱᴛʀᴇǫᴜᴇꜱᴛ'], category: 'GROUP', run: async ({ sock, from, sender }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  try {
        const req = await sock.groupRequestParticipantsList(from);
    if (!req.length) return sock.sendMessage(from, { text: `✅ No pending join requests.`, mentions: [sender] });
    let txt = `📥 *Pending Requests (${req.length})*\n\n`;
    req.forEach((r, i) => txt += `${i + 1}. @${r.jid.split('@')[0]}\n`);
    txt += `\nUse .approve @user / .reject @user`;
    await sock.sendMessage(from, { text: txt, mentions: [sender, ...req.map(r => r.jid)] });
  } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const approve = { name: 'approve', alias: ['ᴀᴘᴘʀᴏᴠᴇ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .approve @user`, mentions: [sender] });
  try { await sock.groupRequestParticipantsUpdate(from, [t], 'approve'); await sock.sendMessage(from, { text: `✅ Approved @${t.split('@')[0]}`, mentions: [sender, t] }); } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const reject = { name: 'reject', alias: ['ʀᴇᴊᴇᴄᴛ'], category: 'GROUP', run: async ({ sock, from, sender, args, msg }) => {
  if (!needGroup(from, sock, sender)) return;
  if (!await isAdmin(sock, from, sender)) return sock.sendMessage(from, { text: `❌ Admin only.`, mentions: [sender] });
  const t = getTarget(msg, args); if (!t) return sock.sendMessage(from, { text: `❌ Usage: .reject @user`, mentions: [sender] });
  try { await sock.groupRequestParticipantsUpdate(from, [t], 'reject'); await sock.sendMessage(from, { text: `❌ Rejected @${t.split('@')[0]}`, mentions: [sender, t] }); } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
}};
const pick = { name: 'pick', alias: ['ᴘɪᴄᴋ'], category: 'GROUP', run: async ({ sock, from, sender, text }) => {
  if (!needGroup(from, sock, sender)) return;
  const m = await sock.groupMetadata(from);
  const random = m.participants[Math.floor(Math.random() * m.participants.length)];
  await sock.sendMessage(from, { text: `🎲 *Pick*\n\n${text || 'Picked:'} @${random.id.split('@')[0]} 🎉`, mentions: [sender, random.id] });
}};

module.exports = [join, leave, gpp, gname, gdesc, add, kick, tkick, promote, demote, mute, unmute, invite, revoke, tag, tagall, all, creategc, lock, unlock, ginfo, events, antilink, akick, antiword, warn, antigm, antigcstatus, antibot, antispam, antitag, reset, kickr, gcstatus, listrequest, approve, reject, pick];
