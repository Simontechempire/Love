const axios = require('axios');
const fs = require('fs');

// Download image from URL - for Postimages DP / Menu
async function getBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch (e) {
    console.log('getBuffer error:', e.message);
    return null;
  }
}

// Fetch JSON
async function fetchJson(url) {
  try {
    const res = await axios.get(url);
    return res.data;
  } catch (e) {
    return null;
  }
}

// Format Uptime
function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  let h = Math.floor(s / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// Format Date
function formatDate() {
  return new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
}

// Check if user is Owner - Simon Tech
function isOwner(sender, config) {
  const num = sender.split('@')[0].replace(/[^0-9]/g, '');
  return config.ownerNumbers.includes(num) || config.ownerNumber === num;
}

// Get Group Admins
async function getGroupAdmins(participants) {
  return participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
}

// Sleep
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  getBuffer,
  fetchJson,
  formatUptime,
  formatDate,
  isOwner,
  getGroupAdmins,
  sleep
};
