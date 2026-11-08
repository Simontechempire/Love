const axios = require('axios');

// Real APIs - no fake, no placeholder
async function waifuPics(action) {
  const r = await axios.get(`https://api.waifu.pics/sfw/${action}`, { timeout: 15000 });
  return r.data.url;
}
async function nekosBest(action) {
  const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 15000 });
  return r.data.results[0].url;
}

async function sendAction(sock, from, sender, target, action, verb) {
  try {
    const url = await waifuPics(action);
    const who = target ? `@${target.split('@')[0]}` : `@${sender.split('@')[0]}`;
    const me = `@${sender.split('@')[0]}`;
    const caption = target
      ? `◈┈▉ *Love FUN* ▉┄◈\n\n${me} ${verb} ${who} 💖`
      : `◈┈▉ *Love FUN* ▉┄◈\n\n${me} ${verb} themselves 😂`;
    await sock.sendMessage(from, { image: { url }, caption, mentions: [sender, ...(target ? [target] : [])] });
  } catch (e) {
    await sock.sendMessage(from, { text: `❌ Failed: ${e.message}`, mentions: [sender] });
  }
}

function getTarget(msg, args, sender) {
  if (msg?.mentionedJid?.length) return msg.mentionedJid[0];
  if (msg?.quoted?.sender) return msg.quoted.sender;
  if (args[0] && args[0].includes('@')) return args[0].replace('@','') + '@s.whatsapp.net';
  return null;
}

const slap = { name: 'slap', alias: ['ꜱʟᴀᴘ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'slap', 'slapped') };
const hug = { name: 'hug', alias: ['ʜᴜɢ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'hug', 'hugged') };
const kiss = { name: 'kiss', alias: ['ᴋɪꜱꜱ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'kiss', 'kissed') };
const pat = { name: 'pat', alias: ['ᴘᴀᴛ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'pat', 'patted') };
const cuddle = { name: 'cuddle', alias: ['ᴄᴜᴅᴅʟᴇ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'cuddle', 'cuddled') };
const tickle = { name: 'tickle', alias: ['ᴛɪᴄᴋʟᴇ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'tickle', 'tickled') };
const spank = { name: 'spank', alias: ['ꜱᴘᴀɴᴋ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'spank', 'spanked') };
const feed = { name: 'feed', alias: ['ꜰᴇᴇᴅ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'feed', 'fed') };
const smug = { name: 'smug', alias: ['ꜱᴍᴜɢ'], category: 'FUN', run: async ({ sock, from, sender, args, msg }) => sendAction(sock, from, sender, getTarget(msg, args, sender), 'smug', 'smugged at') };

const neko = {
  name: 'neko', alias: ['ɴᴇᴋᴏ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await waifuPics('neko'); await sock.sendMessage(from, { image: { url }, caption: `◈┈▉ *Neko* ▉┄◈\n\nHere is your neko 🐱`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const waifu = {
  name: 'waifu', alias: ['ᴡᴀɪꜰᴜ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await waifuPics('waifu'); await sock.sendMessage(from, { image: { url }, caption: `◈┈▉ *Waifu* ▉┄◈\n\nHere is your waifu 💖`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const meow = {
  name: 'meow', alias: ['ᴍᴇᴏᴡ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const r = await axios.get('https://aws.random.cat/meow', { timeout: 15000 }); await sock.sendMessage(from, { image: { url: r.data.file }, caption: `🐱 Meow!`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const woof = {
  name: 'woof', alias: ['ᴡᴏᴏꜰ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 15000 }); await sock.sendMessage(from, { image: { url: r.data.message }, caption: `🐶 Woof!`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const goose = {
  name: 'goose', alias: ['ɢᴏᴏꜱᴇ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await nekosBest('goose'); await sock.sendMessage(from, { image: { url }, caption: `🪿 Goose!`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const lizard = {
  name: 'lizard', alias: ['ʟɪᴢᴀʀᴅ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await nekosBest('lizard'); await sock.sendMessage(from, { image: { url }, caption: `🦎 Lizard!`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const foxgirl = {
  name: 'foxgirl', alias: ['ꜰᴏxɢɪʀʟ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await nekosBest('foxgirl'); await sock.sendMessage(from, { image: { url }, caption: `🦊 Fox Girl!`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const wallpaper = {
  name: 'wallpaper', alias: ['ᴡᴀʟʟᴘᴀᴘᴇʀ'], category: 'FUN',
  run: async ({ sock, from, sender, text }) => {
    try {
      const q = text || 'anime';
      const r = await axios.get(`https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(q)}&sorting=random`, { timeout: 20000 });
      if (!r.data.data.length) throw new Error('No wallpaper found');
      const pick = r.data.data[Math.floor(Math.random() * r.data.data.length)];
      await sock.sendMessage(from, { image: { url: pick.path }, caption: `◈┈▉ *Wallpaper* ▉┄◈\n\n🔍 ${q}\n📐 ${pick.resolution}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const ngif = {
  name: 'ngif', alias: ['ɴɢɪꜰ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try { const url = await nekosBest('ngif'); await sock.sendMessage(from, { video: { url }, gifPlayback: true, caption: `😹 Neko GIF`, mentions: [sender] }); }
    catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const pickupl = {
  name: 'pickupl', alias: ['ᴘɪᴄᴋᴜᴘʟ'], category: 'FUN',
  run: async ({ sock, from, sender, args, msg }) => {
    try {
      const r = await axios.get('https://api.popcat.xyz/pickup-lines', { timeout: 15000 });
      const target = getTarget(msg, args, sender);
      const t = target ? `@${target.split('@')[0]} ` : '';
      await sock.sendMessage(from, { text: `💘 *Pickup Line*\n\n${t}${r.data.pickup_line}`, mentions: [sender, ...(target ? [target] : [])] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const breakupl = {
  name: 'breakupl', alias: ['ʙʀᴇᴀᴋᴜᴘʟ'], category: 'FUN',
  run: async ({ sock, from, sender, args, msg }) => {
    try {
      // Real API - JokeAPI dark / breakup style via popcat + fallback handled by API itself
      const r = await axios.get('https://v2.jokeapi.dev/joke/Miscellaneous,Dark?type=single', { timeout: 15000 });
      const target = getTarget(msg, args, sender);
      const t = target ? `@${target.split('@')[0]} ` : '';
      await sock.sendMessage(from, { text: `💔 *Breakup Line*\n\n${t}${r.data.joke}`, mentions: [sender, ...(target ? [target] : [])] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const wyr = {
  name: 'wyr', alias: ['ᴡʏʀ'], category: 'FUN',
  run: async ({ sock, from, sender }) => {
    try {
      const r = await axios.get('https://api.truthordarebot.xyz/v1/wyr', { timeout: 15000 });
      await sock.sendMessage(from, { text: `🤔 *Would You Rather?*\n\n1️⃣ ${r.data.question}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const insult = {
  name: 'insult', alias: ['ɪɴꜱᴜʟᴛ'], category: 'FUN',
  run: async ({ sock, from, sender, args, msg }) => {
    try {
      const r = await axios.get('https://evilinsult.com/generate_insult.php?lang=en&type=json', { timeout: 15000 });
      const target = getTarget(msg, args, sender);
      const t = target ? `@${target.split('@')[0]} ` : '';
      await sock.sendMessage(from, { text: `😈 *Insult*\n\n${t}${r.data.insult}`, mentions: [sender, ...(target ? [target] : [])] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}`, mentions: [sender] }); }
  }
};

const emojimix = {
  name: 'emojimix', alias: ['ᴇᴍᴏᴊɪᴍɪx'], category: 'FUN',
  run: async ({ sock, from, sender, text }) => {
    if (!text || !text.includes('+')) return sock.sendMessage(from, { text: `❌ Usage: .emojimix 😂+😭\nExample: .emojimix 😂+❤️`, mentions: [sender] });
    try {
      const [e1, e2] = text.split('+').map(s => s.trim());
      // Real Google Emoji Kitchen API via Tenor / gstatic
      const url = `https://www.gstatic.com/android/keyboard/emojimix/${e1.codePointAt(0).toString(16)}/${e1.codePointAt(0).toString(16)}_${e2.codePointAt(0).toString(16)}.png`;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, validateStatus: s => s === 200 });
      await sock.sendMessage(from, { sticker: Buffer.from(r.data), mentions: [sender] });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ That emoji combo no dey exist for Emoji Kitchen. Try another combo e.g .emojimix 😂+😭`, mentions: [sender] });
    }
  }
};

module.exports = [slap, hug, kiss, pat, cuddle, tickle, spank, feed, smug, neko, waifu, meow, woof, goose, lizard, foxgirl, wallpaper, ngif, pickupl, breakupl, wyr, insult, emojimix];
