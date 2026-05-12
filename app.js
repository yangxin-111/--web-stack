const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MESSAGE_FILE = path.join(__dirname, 'messages.json');
const DIARY_PUBLIC_FILE = path.join(__dirname, 'diary_public.json');
const PRIVATE_DIARY_DIR = path.join(__dirname, 'private_diaries');

if (!fs.existsSync(PRIVATE_DIARY_DIR)) fs.mkdirSync(PRIVATE_DIARY_DIR, { recursive: true });

function loadJSON(file, fallback = []) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return fallback;
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

let messages = loadJSON(MESSAGE_FILE);
let publicDiary = loadJSON(DIARY_PUBLIC_FILE);

const wss = new WebSocket.Server({ port: PORT });
let onlineUsers = [];

wss.on('connection', (ws) => {
  let currentUser = null;

  ws.send(JSON.stringify({ type: 'history', messages }));
  ws.send(JSON.stringify({ type: 'onlineList', users: onlineUsers }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'join') {
        currentUser = { name: msg.name, avatar: msg.name[0], color: msg.color || '#ff9f4b' };
        if (!onlineUsers.find(u => u.name === currentUser.name)) {
          onlineUsers.push(currentUser);
        }
        broadcastOnlineList();
        broadcastSystem(`${currentUser.name} 加入了群聊`);

      } else if (msg.type === 'chat') {
        const newMsg = { ...msg, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), id: Date.now() + Math.random() };
        messages.push(newMsg);
        if (messages.length > 200) messages = messages.slice(-200);
        saveJSON(MESSAGE_FILE, messages);
        broadcastAll(JSON.stringify({ type: 'chat', ...newMsg }));

      } else if (msg.type === 'diary') {
        const { action, diaryType, entry, username, entryId } = msg;
        if (action === 'load') {
          let entries = diaryType === 'public' ? publicDiary : loadPrivateDiary(username);
          ws.send(JSON.stringify({ type: 'diaryData', diaryType, entries }));

        } else if (action === 'save') {
          if (diaryType === 'public') {
            entry.id = Date.now(); entry.time = new Date().toLocaleString('zh-CN', { hour12: false });
            publicDiary.unshift(entry);
            if (publicDiary.length > 50) publicDiary.pop();
            saveJSON(DIARY_PUBLIC_FILE, publicDiary);
            broadcastAll(JSON.stringify({ type: 'diaryData', diaryType: 'public', entries: publicDiary }));
          } else {
            let entries = loadPrivateDiary(username);
            entry.id = Date.now(); entry.time = new Date().toLocaleString('zh-CN', { hour12: false });
            entries.unshift(entry);
            if (entries.length > 50) entries.pop();
            savePrivateDiary(username, entries);
            ws.send(JSON.stringify({ type: 'diaryData', diaryType: 'private', entries }));
          }

        } else if (action === 'delete' && diaryType === 'private') {
          let entries = loadPrivateDiary(username);
          entries = entries.filter(e => e.id !== entryId);
          savePrivateDiary(username, entries);
          ws.send(JSON.stringify({ type: 'diaryData', diaryType: 'private', entries }));
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    if (currentUser) {
      onlineUsers = onlineUsers.filter(u => u.name !== currentUser.name);
      broadcastOnlineList();
      broadcastSystem(`${currentUser.name} 离开了群聊`);
    }
  });

  function broadcastOnlineList() {
    broadcastAll(JSON.stringify({ type: 'onlineList', users: onlineUsers }));
  }
  function broadcastSystem(text) {
    broadcastAll(JSON.stringify({ type: 'system', text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) }));
  }
  function broadcastAll(data) {
    wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(data); });
  }
});

function loadPrivateDiary(username) {
  const file = path.join(PRIVATE_DIARY_DIR, `${username}.json`);
  return loadJSON(file);
}
function savePrivateDiary(username, entries) {
  const file = path.join(PRIVATE_DIARY_DIR, `${username}.json`);
  saveJSON(file, entries);
}

console.log(`✅ WebSocket 服务运行在 ws://localhost:${PORT}`);
