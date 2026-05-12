cd /root/web-stack && cp app.js app.js.bak && cat > app.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const formidable = require('formidable');

const PORT = 3000;
const MESSAGE_FILE = path.join(__dirname, 'messages.json');
const PRIVATE_DIARY_DIR = path.join(__dirname, 'private_diaries');
const MUSIC_DIR = path.join(__dirname, 'music');

if (!fs.existsSync(PRIVATE_DIARY_DIR)) fs.mkdirSync(PRIVATE_DIARY_DIR, { recursive: true });
if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

function loadJSON(file, fallback = []) {
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}
    return fallback;
}
function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
    // 上传处理
    if (req.url === '/upload' && req.method === 'POST') {
        const form = new formidable.IncomingForm();
        form.uploadDir = MUSIC_DIR;
        form.keepExtensions = true;
        form.maxFileSize = 20 * 1024 * 1024; // 20MB 限制
        form.parse(req, (err, fields, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('上传失败');
                return;
            }
            const file = files.musicFile;
            if (!file || !file.originalFilename.endsWith('.mp3')) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('只允许上传 MP3 文件');
                return;
            }
            const newName = file.originalFilename;
            const newPath = path.join(MUSIC_DIR, newName);
            fs.renameSync(file.filepath, newPath);
            // 更新歌单 playlist.json
            const playlist = loadJSON(path.join(__dirname, 'playlist.json'));
            const title = fields.title || newName.replace('.mp3','');
            playlist.push({ title: title, url: `/music/${newName}` });
            saveJSON(path.join(__dirname, 'playlist.json'), playlist);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('上传成功！刷新页面即可看到新歌');
        });
        return;
    }

    // 静态文件处理
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

const wss = new WebSocket.Server({ server });
function broadcastAll(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(data);
    });
}

wss.on('connection', ws => {
    ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw); } catch(e) { return; }
        if (msg.type === 'chat') {
            const messages = loadJSON(MESSAGE_FILE);
            messages.push({ sender: msg.sender, text: msg.text, time: new Date().toISOString() });
            if (messages.length > 200) messages.shift();
            saveJSON(MESSAGE_FILE, messages);
            broadcastAll(JSON.stringify({ type: 'chat', sender: msg.sender, text: msg.text }));
        } else if (msg.type === 'getHistory') {
            const messages = loadJSON(MESSAGE_FILE);
            ws.send(JSON.stringify({ type: 'history', messages }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ 友间小站运行在 http://localhost:${PORT}`);
});
EOF
