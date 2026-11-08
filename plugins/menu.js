const config = require('../config');
const { getMenu } = require('../Lib/menu');
const { getBuffer } = require('../Lib/function');
module.exports = {
  name: 'menu',
  category: 'HELP',
  run: async ({ sock, from, sender, pushName, pluginCount }) => {
    const text = getMenu({ pushName, pluginCount, uptimeMs: process.uptime() * 1000 });
    const pic = await getBuffer(config.botPic);
    if (pic) await sock.sendMessage(from, { image: pic, caption: text, mentions: [sender] });
    else await sock.sendMessage(from, { text, mentions: [sender] });
  }
};
