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
  let h = Math.floor(s / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
function formatDate() { return new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }); }
function isOwner(sender, config) {
  const num = sender.split('@')[0].replace(/[^0-9]/g, '');
  return config.ownerNumbers.includes(num) || config.ownerNumber === num;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
module.exports = { getBuffer, fetchJson, formatUptime, formatDate, isOwner, sleep };
