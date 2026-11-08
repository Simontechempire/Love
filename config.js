require('dotenv').config();
module.exports = {
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
};
