const axios = require('axios');

async function getBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch (e) { return null; }
}

async function fetchJson(url) {
  try { const res = await axios.get(url); return res.data; } catch { return null; }
}

function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  let d = Math.floor(s / 86400);
  let h = Math.floor((s % 86400) / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  return `${h}h ${m}m ${sec}s`;
}

function formatDate() { return new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }); }

function isOwner(sender, config) {
  const num = sender.split('@')[0].replace(/[^0-9]/g, '');
  return config.ownerNumbers.includes(num) || config.ownerNumber === num;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== NEW - needed by index.js =====
async function downloadMediaMessage(sock, m) {
  try {
    const { downloadContentFromMessage } = require('alip-baileys');
    const msg = m?.message || m;
    const type = m?.mtype || Object.keys(msg || {})[0];
    if (!msg || !msg[type]) return null;
    const stream = await downloadContentFromMessage(msg[type], type.replace('Message', ''));
    let buf = Buffer.from([]);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    return buf;
  } catch (e) { console.log('[DOWNLOAD ERR]', e.message); return null; }
}

module.exports = { getBuffer, fetchJson, formatUptime, formatDate, isOwner, sleep, downloadMediaMessage };
