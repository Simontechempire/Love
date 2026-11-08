require('dotenv').config();

module.exports = {
  // ===== YOURS - kept exactly =====
  botName: process.env.BOT_NAME || "Love",
  version: "1.0.0",
  prefix: process.env.PREFIX || ".",
  ownerName: process.env.OWNER_NAME || "Simon Tech",
  ownerNumber: process.env.OWNER_NUMBER || "2348071569915",
  ownerNumbers: [process.env.OWNER_NUMBER || "2348071569915"],
  botPic: process.env.BOT_PIC || "https://i.postimg.cc/9FDSRFWL/99f8f6a3bdf94a5e43d3e2975e9502fc.jpg",
  sessionFolder: process.env.SESSION_FOLDER || "./auth_love",
  port: process.env.PORT || 3000,
  autoRead: false,
  autoStatus: false,
  alwaysOnline: true,

  // ===== ADDED - needed by plugins/menu =====
  repo: process.env.REPO || "https://github.com/SimonTech/Love",
  sudo: process.env.SUDO ? process.env.SUDO.split(",") : [],
  mods: [],
  mode: process.env.MODE || "public", // public / private / self
  statusEmoji: process.env.STATUS_EMOJI || "❤️",
  imgbbKey: process.env.IMGBB_KEY || "",
  openaiKey: process.env.OPENAI_KEY || "",

  // ===== Toggles - controlled by .setvar / .config cmds =====
  readstatus: false,
  likestatus: false,
  startupmsg: false,
  antidelete: false,
  antiedit: false,
  antieditchat: false,
  savestatus: false,
  cmdreact: false,
  readmsg: false,
  rejectcall: false,
  savecmd: false,
  vvcmd: false,

  // ===== ADDED - LOVE index.js compatibility - DO NOT REMOVE =====
  // index.js uses these names, config.js uses ownerName/ownerNumber
  // We add aliases so BOTH work, no crash
  ownerAlias: process.env.OWNER_NAME || "Simon Tech",
  owners: [process.env.OWNER_NUMBER || "2348071569915"],
  owner: process.env.OWNER_NUMBER || "2348071569915",
  prefixes: [process.env.PREFIX || "."],
  hosting: process.env.HOSTING || "Render",
  forceMode: false,
  messages: {
    ownerOnly: "❌ Owner only command.",
    groupOnly: "❌ Group only command.",
  },
};
