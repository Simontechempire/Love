const axios = require('axios');

// Base for Vreden free API - real, no key
const V = 'https://api.vreden.my.id/api';

async function getJson(url) {
  const r = await axios.get(url, { timeout: 40000 });
  return r.data;
}

const tiktok = {
  name: 'tiktok', alias: ['ᴛɪᴋᴛᴏᴋ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .tiktok <tiktok link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading TikTok...`, mentions: [sender] });
      const d = await getJson(`https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`);
      if (!d.data || !d.data.play) throw new Error('No video found');
      await sock.sendMessage(from, { video: { url: d.data.play }, caption: `◈┈▉ *TikTok* ▉┄◈\n\n👤 @${d.data.author?.nickname || 'unknown'}\n📝 ${d.data.title || ''}\n❤️ ${d.data.digg_count || 0} | 💬 ${d.data.comment_count || 0}`, mentions: [sender] });
      if (d.data.music) await sock.sendMessage(from, { audio: { url: d.data.music }, mimetype: 'audio/mp4', mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ TikTok failed: ${e.message}`, mentions: [sender] }); }
  }
};

const igdl = {
  name: 'igdl', alias: ['ɪɢᴅʟ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .igdl <instagram link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading Instagram...`, mentions: [sender] });
      const d = await getJson(`${V}/instagram?url=${encodeURIComponent(text)}`);
      const result = d.result || d.data || [];
      const urls = Array.isArray(result) ? result : [result];
      if (!urls.length || !urls[0]?.url) throw new Error('No media found - make sure post is public');
      for (const item of urls.slice(0, 3)) {
        const url = item.url || item;
        if (url.includes('.mp4')) await sock.sendMessage(from, { video: { url }, caption: `📸 Instagram`, mentions: [sender] });
        else await sock.sendMessage(from, { image: { url }, caption: `📸 Instagram`, mentions: [sender] });
      }
    } catch (e) { await sock.sendMessage(from, { text: `❌ IG failed: ${e.message}`, mentions: [sender] }); }
  }
};

const fbdl = {
  name: 'fbdl', alias: ['ꜰʙᴅʟ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .fbdl <facebook link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading Facebook...`, mentions: [sender] });
      const d = await getJson(`${V}/fbdl?url=${encodeURIComponent(text)}`);
      const url = d.result?.hd || d.result?.sd || d.data?.hd || d.data?.sd || d.result?.url;
      if (!url) throw new Error('No video found - make sure video is public');
      await sock.sendMessage(from, { video: { url }, caption: `📘 Facebook Video`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ FB failed: ${e.message}`, mentions: [sender] }); }
  }
};

const ytmp3 = {
  name: 'ytmp3', alias: ['ʏᴛᴍᴘ3'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .ytmp3 <youtube link / search>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading MP3...`, mentions: [sender] });
      const d = await getJson(`${V}/ytmp3?url=${encodeURIComponent(text)}`);
      const url = d.result?.download || d.result?.url || d.data?.download;
      const title = d.result?.title || d.result?.metadata?.title || 'YouTube Audio';
      if (!url) throw new Error('No audio found');
      await sock.sendMessage(from, { audio: { url }, mimetype: 'audio/mpeg', fileName: `${title}.mp3`, caption: `🎵 ${title}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ YTMP3 failed: ${e.message}`, mentions: [sender] }); }
  }
};

const ytmp4 = {
  name: 'ytmp4', alias: ['ʏᴛᴍᴘ4'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .ytmp4 <youtube link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading MP4...`, mentions: [sender] });
      const d = await getJson(`${V}/ytmp4?url=${encodeURIComponent(text)}`);
      const url = d.result?.download || d.result?.url || d.data?.download;
      const title = d.result?.title || 'YouTube Video';
      if (!url) throw new Error('No video found');
      await sock.sendMessage(from, { video: { url }, caption: `🎬 ${title}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ YTMP4 failed: ${e.message}`, mentions: [sender] }); }
  }
};

const yts = {
  name: 'yts', alias: ['ʏᴛꜱ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .yts <search>\nExample: .yts Asake Lonely At The Top`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/yts?query=${encodeURIComponent(text)}`);
      const list = d.result || d.data || [];
      if (!list.length) throw new Error('No results');
      let txt = `🔍 *YouTube Search: ${text}*\n\n`;
      list.slice(0, 8).forEach((v, i) => {
        txt += `${i + 1}. *${v.title}*\n👤 ${v.channel || v.author} | ⏱️ ${v.duration || v.timestamp}\n🔗 ${v.url}\n\n`;
      });
      txt += `Use .ytmp3 <link> or .ytmp4 <link> to download`;
      await sock.sendMessage(from, { text: txt, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ YTS failed: ${e.message}`, mentions: [sender] }); }
  }
};

const spotify = {
  name: 'spotify', alias: ['ꜱᴘᴏᴛɪꜰʏ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .spotify <spotify link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading Spotify...`, mentions: [sender] });
      const d = await getJson(`${V}/spotify?url=${encodeURIComponent(text)}`);
      const url = d.result?.download || d.result?.url || d.data?.download;
      const title = d.result?.title || d.result?.name || 'Spotify Track';
      const artist = d.result?.artist || d.result?.artists || '';
      if (!url) throw new Error('No audio found');
      await sock.sendMessage(from, { audio: { url }, mimetype: 'audio/mpeg', fileName: `${title}.mp3`, caption: `🎵 ${title} - ${artist}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Spotify failed: ${e.message}`, mentions: [sender] }); }
  }
};

const spotifyplay = {
  name: 'spotifyplay', alias: ['ꜱᴘᴏᴛɪꜰʏᴘʟᴀʏ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .spotifyplay <song name>\nExample: .spotifyplay Asake Lonely At The Top`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/spotifysearch?query=${encodeURIComponent(text)}`);
      const list = d.result || d.data || [];
      if (!list.length) throw new Error('No results');
      let txt = `🎵 *Spotify Search: ${text}*\n\n`;
      list.slice(0, 8).forEach((v, i) => { txt += `${i + 1}. *${v.title || v.name}*\n👤 ${v.artist || v.artists}\n🔗 ${v.url}\n\n`; });
      txt += `Use .spotify <link> to download`;
      await sock.sendMessage(from, { text: txt, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ SpotifyPlay failed: ${e.message}`, mentions: [sender] }); }
  }
};

const pinterest = {
  name: 'pinterest', alias: ['ᴘɪɴᴛᴇʀᴇꜱᴛ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .pinterest <search>\nExample: .pinterest anime girl`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/pinterest?query=${encodeURIComponent(text)}`);
      const list = d.result || d.data || [];
      if (!list.length) throw new Error('No images found');
      const pick = list[Math.floor(Math.random() * Math.min(list.length, 10))];
      const url = pick.image || pick.url || pick;
      await sock.sendMessage(from, { image: { url }, caption: `📌 Pinterest: ${text}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Pinterest failed: ${e.message}`, mentions: [sender] }); }
  }
};

const wallpaper = {
  name: 'wallpaper', alias: ['ᴡᴀʟʟᴘᴀᴘᴇʀ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    try {
      const q = text || 'anime';
      const r = await axios.get(`https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(q)}&sorting=random`, { timeout: 20000 });
      if (!r.data.data.length) throw new Error('No wallpaper found');
      const pick = r.data.data[Math.floor(Math.random() * r.data.data.length)];
      await sock.sendMessage(from, { image: { url: pick.path }, caption: `🖼️ Wallpaper: ${q}\n📐 ${pick.resolution}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Wallpaper failed: ${e.message}`, mentions: [sender] }); }
  }
};

const mediafire = {
  name: 'mediafire', alias: ['ᴍᴇᴅɪᴀꜰɪʀᴇ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .mediafire <mediafire link>`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/mediafire?url=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      if (!res.link && !res.url) throw new Error('No file found');
      await sock.sendMessage(from, { text: `📁 *MediaFire*\n\n📄 Name: ${res.filename || res.title || 'File'}\n📦 Size: ${res.size || 'Unknown'}\n🔗 Download: ${res.link || res.url}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ MediaFire failed: ${e.message}`, mentions: [sender] }); }
  }
};

const gdrive = {
  name: 'gdrive', alias: ['ɢᴅʀɪᴠᴇ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text || !text.includes('drive.google.com')) return sock.sendMessage(from, { text: `❌ Usage: .gdrive <google drive link>`, mentions: [sender] });
    try {
      const idMatch = text.match(/\/d\/([a-zA-Z0-9_-]+)/) || text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (!idMatch) throw new Error('Invalid Drive link');
      const id = idMatch[1];
      const direct = `https://drive.google.com/uc?export=download&id=${id}`;
      await sock.sendMessage(from, { text: `📁 *Google Drive*\n\n🔗 Direct Download:\n${direct}\n\nOpen link to download file.`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ GDrive failed: ${e.message}`, mentions: [sender] }); }
  }
};

const capcut = {
  name: 'capcut', alias: ['ᴄᴀᴘᴄᴜᴛ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .capcut <capcut template link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading CapCut...`, mentions: [sender] });
      const d = await getJson(`${V}/capcut?url=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      const url = res.video || res.url || res.download;
      if (!url) throw new Error('No template found');
      await sock.sendMessage(from, { video: { url }, caption: `✂️ CapCut: ${res.title || ''}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ CapCut failed: ${e.message}`, mentions: [sender] }); }
  }
};

const apk = {
  name: 'apk', alias: ['ᴀᴘᴋ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .apk <app name>\nExample: .apk whatsapp`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Searching APK...`, mentions: [sender] });
      const d = await getJson(`${V}/apk?query=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      if (!res.download && !res.url) throw new Error('APK not found');
      await sock.sendMessage(from, { text: `📱 *APK: ${res.name || text}*\n\n👤 Dev: ${res.developer || 'Unknown'}\n📦 Size: ${res.size || 'Unknown'}\n⭐ Rating: ${res.rating || 'Unknown'}\n🔗 Download: ${res.download || res.url}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ APK failed: ${e.message}`, mentions: [sender] }); }
  }
};

const terabox = {
  name: 'terabox', alias: ['ᴛᴇʀᴀʙᴏx'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .terabox <terabox link>`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/terabox?url=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      const url = res.link || res.url || res.download;
      if (!url) throw new Error('No file found');
      await sock.sendMessage(from, { text: `📦 *Terabox*\n\n📄 ${res.filename || res.title || 'File'}\n📦 Size: ${res.size || 'Unknown'}\n🔗 ${url}`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Terabox failed: ${e.message}`, mentions: [sender] }); }
  }
};

const xdl = {
  name: 'xdl', alias: ['xᴅʟ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .xdl <twitter / x link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading X...`, mentions: [sender] });
      const d = await getJson(`${V}/twitter?url=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      const url = res.video || res.url || res.download;
      if (!url) throw new Error('No media found');
      if (url.includes('.mp4')) await sock.sendMessage(from, { video: { url }, caption: `🐦 X Video`, mentions: [sender] });
      else await sock.sendMessage(from, { image: { url }, caption: `🐦 X Image`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ X failed: ${e.message}`, mentions: [sender] }); }
  }
};

const insta = {
  name: 'insta', alias: ['ɪɴꜱᴛᴀ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .insta <instagram profile / post link>`, mentions: [sender] });
    try {
      const d = await getJson(`${V}/instagram?url=${encodeURIComponent(text)}`);
      const result = d.result || d.data || [];
      const urls = Array.isArray(result) ? result : [result];
      if (!urls.length || !urls[0]?.url) throw new Error('No media found');
      for (const item of urls.slice(0, 3)) {
        const url = item.url || item;
        if (url.includes('.mp4')) await sock.sendMessage(from, { video: { url }, caption: `📸 Insta`, mentions: [sender] });
        else await sock.sendMessage(from, { image: { url }, caption: `📸 Insta`, mentions: [sender] });
      }
    } catch (e) { await sock.sendMessage(from, { text: `❌ Insta failed: ${e.message}`, mentions: [sender] }); }
  }
};

const threads = {
  name: 'threads', alias: ['ᴛʜʀᴇᴀᴅꜱ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .threads <threads link>`, mentions: [sender] });
    try {
      await sock.sendMessage(from, { text: `⏳ Downloading Threads...`, mentions: [sender] });
      const d = await getJson(`${V}/threads?url=${encodeURIComponent(text)}`);
      const res = d.result || d.data || {};
      const url = res.video || res.image || res.url;
      if (!url) throw new Error('No media found');
      if (url.includes('.mp4')) await sock.sendMessage(from, { video: { url }, caption: `🧵 Threads`, mentions: [sender] });
      else await sock.sendMessage(from, { image: { url }, caption: `🧵 Threads`, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ Threads failed: ${e.message}`, mentions: [sender] }); }
  }
};

const imdb = {
  name: 'imdb', alias: ['ɪᴍᴅʙ'], category: 'DOWNLOADER',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .imdb <movie name>\nExample: .imdb Avengers`, mentions: [sender] });
    try {
      const r = await axios.get(`https://api.imdbapi.dev/search?query=${encodeURIComponent(text)}`, { timeout: 20000 });
      const m = r.data?.titles?.[0] || r.data?.[0];
      if (!m) throw new Error('Movie not found');
      const poster = m.primaryImage?.url || m.poster;
      const txt = `🎬 *${m.title || m.primaryTitle}*\n\n📅 Year: ${m.startYear || m.year || 'Unknown'}\n⭐ Rating: ${m.rating?.aggregateRating || 'N/A'}\n🎭 Type: ${m.type || 'Movie'}\n📝 Plot: ${m.plot || 'No plot available'}`;
      if (poster) await sock.sendMessage(from, { image: { url: poster }, caption: txt, mentions: [sender] });
      else await sock.sendMessage(from, { text: txt, mentions: [sender] });
    } catch (e) { await sock.sendMessage(from, { text: `❌ IMDB failed: ${e.message}`, mentions: [sender] }); }
  }
};

module.exports = [tiktok, igdl, fbdl, ytmp3, ytmp4, yts, spotify, spotifyplay, pinterest, wallpaper, mediafire, gdrive, capcut, apk, terabox, xdl, insta, threads, imdb];
