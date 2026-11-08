const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Real memory for chatbot - per user, while bot dey run
const history = new Map();

async function callAI(prompt) {
  const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`, { timeout: 50000 });
  const out = typeof res.data === 'string' ? res.data.trim() : JSON.stringify(res.data);
  if (!out) throw new Error('Empty response from AI');
  return out;
}

const gpt = {
  name: 'gpt',
  alias: ['ɢᴘᴛ'],
  category: 'AI',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .gpt <question>\nExample: .gpt What is photosynthesis?`, mentions: [sender] });
    await sock.sendMessage(from, { text: `💭 Thinking...`, mentions: [sender] });
    try {
      const answer = await callAI(text);
      await sock.sendMessage(from, { text: `◈┈▉ *Love GPT* ▉┄◈\n\n*Q:* ${text}\n\n${answer}\n\n◈┈▉ *~*_Love_*~* ▉┄◈`, mentions: [sender] });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ GPT failed: ${e.message}`, mentions: [sender] });
    }
  }
};

const scribe = {
  name: 'scribe',
  alias: ['ꜱᴄʀɪʙᴇ'],
  category: 'AI',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .scribe <topic>\nExample: .scribe Write a love letter to my girlfriend`, mentions: [sender] });
    await sock.sendMessage(from, { text: `✍️ Scribe is writing...`, mentions: [sender] });
    try {
      const prompt = `You are Scribe, a professional writer for WhatsApp. Write a complete, well-structured piece about: ${text}. Use headings, paragraphs, emotional tone, proper grammar. Do not use placeholders.`;
      const out = await callAI(prompt);
      await sock.sendMessage(from, { text: `◈┈▉ *Love Scribe* ▉┄◈\n\n${out}\n\n◈┈▉ *~*_Love_*~* ▉┄◈`, mentions: [sender] });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Scribe failed: ${e.message}`, mentions: [sender] });
    }
  }
};

const forge = {
  name: 'forge',
  alias: ['ꜰᴏʀɢᴇ'],
  category: 'AI',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .forge <what to code>\nExample: .forge calculator in html with css and js`, mentions: [sender] });
    await sock.sendMessage(from, { text: `🔨 Forging code...`, mentions: [sender] });
    try {
      const prompt = `You are Forge, an expert programmer. Write complete, working, runnable code for: ${text}. Return ONLY the full code with comments. No explanation, no placeholders, no TODO, no incomplete parts. Code must run as-is.`;
      const code = await callAI(prompt);
      if (code.length > 5000) {
        const file = path.join(__dirname, `forge-${Date.now()}.txt`);
        fs.writeFileSync(file, code);
        await sock.sendMessage(from, { document: fs.readFileSync(file), mimetype: 'text/plain', fileName: `forge-${Date.now()}.txt`, caption: `◈┈▉ *Love Forge* ▉┄◈\n\n*Request:* ${text}`, mentions: [sender] });
        fs.unlinkSync(file);
      } else {
        await sock.sendMessage(from, { text: `◈┈▉ *Love Forge* ▉┄◈\n\n*Request:* ${text}\n\n\`\`\`\n${code}\n\`\`\``, mentions: [sender] });
      }
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Forge failed: ${e.message}`, mentions: [sender] });
    }
  }
};

const chatbot = {
  name: 'chatbot',
  alias: ['ᴄʜᴀᴛʙᴏᴛ'],
  category: 'AI',
  run: async ({ sock, from, sender, text }) => {
    if (!text) return sock.sendMessage(from, { text: `❌ Usage: .chatbot <message>\nExample: .chatbot Hi, how are you?\n\nTip: .chatbot reset to clear memory`, mentions: [sender] });
    if (text.toLowerCase().trim() === 'reset') {
      history.delete(sender);
      return sock.sendMessage(from, { text: `✅ Chat memory cleared.`, mentions: [sender] });
    }
    try {
      const prev = history.get(sender) || [];
      prev.push(`User: ${text}`);
      const recent = prev.slice(-12).join('\n');
      const prompt = `You are Love Chatbot, a friendly, funny, helpful WhatsApp AI created by Simon Tech. You remember conversation. Keep replies short, natural, human, not robotic. Conversation so far:\n${recent}\nLove:`;
      const reply = await callAI(prompt);
      prev.push(`Love: ${reply}`);
      history.set(sender, prev);
      await sock.sendMessage(from, { text: reply, mentions: [sender] });
    } catch (e) {
      await sock.sendMessage(from, { text: `❌ Chatbot failed: ${e.message}`, mentions: [sender] });
    }
  }
};

// All 4 AI cmds inside ONE file
module.exports = [gpt, scribe, forge, chatbot];
