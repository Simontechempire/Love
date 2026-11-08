// Plugins/game.js - TTT + WCG real state
const games=new Map();
const mk=(n,a,f)=>({name:n,alias:[a],category:'GAME',run:f});
function board(b){return `${b[0]||'1️⃣'} ${b[1]||'2️⃣'} ${b[2]||'3️⃣'}\n${b[3]||'4️⃣'} ${b[4]||'5️⃣'} ${b[5]||'6️⃣'}\n${b[6]||'7️⃣'} ${b[7]||'8️⃣'} ${b[8]||'9️⃣'}`;}
function winner(b){const w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,c,d] of w)if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return b.every(x=>x)?'draw':null;}
const ttt=mk('ttt','ᴛᴛᴛ',async({sock,from,sender,args,msg,text})=>{
  const key=from;
  if(!games.has(key)){
    const opp=msg?.mentionedJid?.[0];if(!opp)return sock.sendMessage(from,{text:`❌ .ttt @opponent to start\nThen .ttt <1-9> to play`,mentions:[sender]});
    games.set(key,{board:Array(9).fill(null),players:[sender,opp],turn:0});
    return sock.sendMessage(from,{text:`🎲 *Tic Tac Toe Started*\n\n@${sender.split('@')[0]} ❌ vs @${opp.split('@')[0]} ⭕\n\n${board(Array(9).fill(null))}\n\n@${sender.split('@')[0]} play: .ttt <1-9>`,mentions:[sender,opp]});
  }
  const g=games.get(key);const me=g.players.indexOf(sender);if(me===-1)return sock.sendMessage(from,{text:`❌ Not your game`,mentions:[sender]});if(g.turn!==me)return sock.sendMessage(from,{text:`❌ Not your turn`,mentions:[sender]});
  const pos=parseInt(text)-1;if(isNaN(pos)||pos<0||pos>8||g.board[pos])return sock.sendMessage(from,{text:`❌ Invalid move. Use 1-9 free spot`,mentions:[sender]});
  g.board[pos]=me===0?'❌':'⭕';const win=winner(g.board);
  if(win){games.delete(key);if(win==='draw')return sock.sendMessage(from,{text:`🤝 Draw!\n\n${board(g.board)}`,mentions:g.players});return sock.sendMessage(from,{text:`🏆 @${sender.split('@')[0]} wins!\n\n${board(g.board)}`,mentions:g.players});}
  g.turn=1-g.turn;await sock.sendMessage(from,{text:`${board(g.board)}\n\n@${g.players[g.turn].split('@')[0]} your turn: .ttt <1-9>`,mentions:g.players});
});
const delttt=mk('delttt','ᴅᴇʟᴛᴛᴛ',async({sock,from,sender})=>{games.delete(from);await sock.sendMessage(from,{text:`✅ TTT game deleted.`,mentions:[sender]});});
const wcg=mk('wcg','ᴡᴄɢ',async({sock,from,sender,text})=>{
  const key=`wcg-${from}`;
  if(!games.has(key)){
    const word=['LOVE','SIMON','NIGERIA','WHATSAPP','BOT','ANIME','MUSIC','FOOTBALL'][Math.floor(Math.random()*8)];
    games.set(key,{word,guessed:[],lives:6});
    return sock.sendMessage(from,{text:`🎮 *Word Chain Game*\n\nWord: ${'_ '.repeat(word.length)}\nLives: 6\n\nGuess letter: .wcg <letter>`,mentions:[sender]});
  }
  const g=games.get(key);const letter=(text||'').toUpperCase()[0];if(!letter||!/[A-Z]/.test(letter))return sock.sendMessage(from,{text:`❌ .wcg <letter>`,mentions:[sender]});
  if(g.guessed.includes(letter))return sock.sendMessage(from,{text:`❌ Already guessed ${letter}`,mentions:[sender]});
  g.guessed.push(letter);if(!g.word.includes(letter))g.lives--;
  const disp=g.word.split('').map(c=>g.guessed.includes(c)?c:'_').join(' ');
  if(!disp.includes('_')){games.delete(key);return sock.sendMessage(from,{text:`🏆 You guessed: ${g.word}!`,mentions:[sender]});}
  if(g.lives<=0){games.delete(key);return sock.sendMessage(from,{text:`💀 Game over! Word was: ${g.word}`,mentions:[sender]});}
  await sock.sendMessage(from,{text:`${disp}\nLives: ${g.lives} | Guessed: ${g.guessed.join(', ')}`,mentions:[sender]});
});
const delwcg=mk('delwcg','ᴅᴇʟᴡᴄɢ',async({sock,from,sender})=>{games.delete(`wcg-${from}`);await sock.sendMessage(from,{text:`✅ WCG deleted.`,mentions:[sender]});});
module.exports=[delttt,ttt,wcg,delwcg];
