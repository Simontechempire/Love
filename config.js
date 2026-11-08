require('dotenv').config();

module.exports = {
  // Bot Info - from .env, if .env no dey, e go use this default
  botName: process.env.BOT_NAME || "Love",
  version: "1.0.0",
  prefix: process.env.PREFIX || ".",

  // Owner - Simon Tech
  ownerName: process.env.OWNER_NAME || "Simon Tech",
  ownerNumber: process.env.OWNER_NUMBER || "2348071569915",
  ownerNumbers: [process.env.OWNER_NUMBER || "2348071569915"],

  // Bot Picture - Your Postimages Link
  botPic: process.env.BOT_PIC || "https://i.postimg.cc/9FDSRFWL/99f8f6a3bdf94a5e43d3e2975e9502fc.jpg",

  // Session & Server - Pairing Only, No QR
  sessionFolder: process.env.SESSION_FOLDER || "./auth_love",
  port: process.env.PORT || 3000,

  // Bot Behaviour
  autoRead: false,
  autoStatus: false,
  alwaysOnline: true,
};
