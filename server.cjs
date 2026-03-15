#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 13000;
const ROOT_DIR = '/home/kimjin';

const sessions = {};
const users = { admin: { password: 'admin', name: 'Administrator', role: 'admin' } };

function generateSession() { return 'sess_' + Math.random().toString(36).substr(2, 9); }

function isAuthenticated(req) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/session=([^;]+)/);
  return match && sessions[match[1]];
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function sendHTML(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function listDir(dirPath) {
  try {
    const safe = dirPath.replace(/\.\./g, '').replace(/^\/+/, '');
    const fullPath = path.join(ROOT_DIR, safe);
    if (!fullPath.startsWith(ROOT_DIR)) return { error: 'Access denied' };

    const files = fs.readdirSync(fullPath);
    const items = [];

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const stat = fs.statSync(filePath);
      items.push({
        name: file,
        type: stat.isDirectory() ? 'dir' : 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
        icon: stat.isDirectory() ? '📂' : (file.match(/\.(jpg|png|gif)$/i) ? '🖼️' : '📄')
      });
    }

    return { path: dirPath, items: items.sort((a, b) => a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)) };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`📨 ${req.method} ${pathname}`);

  if (pathname === '/' || pathname === '/index.html') return sendHTML(res, getDashboardHTML());
  if (pathname === '/health') return sendJSON(res, 200, { status: 'ok' });

  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/auth/login') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const user = users[data.username];
          if (user && user.password === data.password) {
            const session = generateSession();
            sessions[session] = { username: data.username, role: user.role };
            res.writeHead(200, { 'Set-Cookie': `session=${session}; Path=/; HttpOnly`, 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ status: 'ok', token: session, user: { username: data.username, role: user.role } }));
          } else {
            sendJSON(res, 401, { status: 'error', message: 'Invalid credentials' });
          }
        } catch (err) {
          sendJSON(res, 400, { status: 'error', message: err.message });
        }
      });
      return;
    }

    if (!isAuthenticated(req)) return sendJSON(res, 401, { status: 'error', message: 'Unauthorized' });

    if (pathname === '/api/fs/list') {
      const dirPath = query.path || '/';
      const result = listDir(dirPath);
      return sendJSON(res, result.error ? 400 : 200, result);
    }

    if (pathname === '/api/auth/me') {
      const cookies = req.headers.cookie || '';
      const match = cookies.match(/session=([^;]+)/);
      if (match && sessions[match[1]]) {
        const session = sessions[match[1]];
        return sendJSON(res, 200, { status: 'ok', user: { username: session.username, role: session.role } });
      }
      return sendJSON(res, 401, { status: 'error', message: 'Unauthorized' });
    }

    return sendJSON(res, 404, { status: 'error', message: 'Not found' });
  }

  sendJSON(res, 404, { status: 'error', message: 'Not found' });
}

function getDashboardHTML() {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>FreeLang File Manager</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;color:#333}.container{display:flex;height:100vh}.sidebar{width:280px;background:linear-gradient(180deg,#2c3e50,#1a252f);color:#fff;padding:20px;overflow-y:auto;border-right:1px solid #34495e}.sidebar h2{font-size:18px;margin-bottom:20px}.nav-section{margin-bottom:30px}.nav-label{font-size:12px;color:#95a5a6;margin-bottom:10px;text-transform:uppercase}.nav-item{display:block;padding:10px 15px;margin:5px 0;color:#ecf0f1;text-decoration:none;border-radius:4px;cursor:pointer}.nav-item:hover{background:#34495e}.nav-item.active{background:#3498db;font-weight:bold}.main{flex:1;display:flex;flex-direction:column}.header{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}.header h1{font-size:24px;margin-bottom:5px}.content{flex:1;padding:20px;overflow-y:auto}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:30px}.stat-card{background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);border-left:4px solid #667eea}.stat-label{font-size:12px;color:#999;margin-bottom:10px}.stat-value{font-size:28px;font-weight:bold}.file-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px}.file-item{background:#fff;padding:15px;border-radius:8px;text-align:center;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.1)}.file-item:hover{transform:translateY(-4px);box-shadow:0 4px 12px rgba(0,0,0,0.15);background:#f9f9f9}.file-icon{font-size:32px;margin-bottom:10px}.file-name{font-size:13px;word-break:break-all}.login-form{max-width:400px;margin:50px auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}.form-group{margin-bottom:15px}.form-label{display:block;margin-bottom:5px;font-weight:600}.form-input{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-size:14px}.form-input:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}.form-btn{width:100%;padding:10px;background:#667eea;color:#fff;border:none;border-radius:4px;font-size:14px;font-weight:600;cursor:pointer}.form-btn:hover{background:#5568d3}.error{color:#e74c3c;font-size:12px;margin-top:5px}</style></head><body><div class="container"><div class="sidebar"><h2>📁 File Manager</h2><div class="nav-section"><div class="nav-label">Navigation</div><div class="nav-item active" onclick="navigateTo('/') ">📂 Files</div></div><div class="nav-section"><div class="nav-label">User</div><div id="user-info"></div><div class="nav-item" onclick="logout()" id="logout-btn" style="display:none">🚪 Logout</div></div></div><div class="main"><div class="header"><h1 id="page-title">🚀 File Manager</h1></div><div class="content" id="content"><div class="login-form"><h2 style="margin-bottom:20px">Sign In</h2><div class="form-group"><label class="form-label">Username</label><input type="text" id="username" class="form-input" value="admin"></div><div class="form-group"><label class="form-label">Password</label><input type="password" id="password" class="form-input" value="admin"></div><button class="form-btn" onclick="login()">Sign In</button><div id="login-error" class="error"></div></div></div></div></div><script>let isLoggedIn=false;async function checkAuth(){try{const res=await fetch('/api/auth/me');if(res.ok){const data=await res.json();isLoggedIn=true;document.getElementById('login-form').style.display='none';document.getElementById('logout-btn').style.display='block';document.getElementById('user-info').innerHTML='👤 '+data.user.username;navigateTo('/')}}catch(err){}}async function login(){const username=document.getElementById('username').value;const password=document.getElementById('password').value;try{const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await res.json();if(res.ok){isLoggedIn=true;document.getElementById('login-form').style.display='none';document.getElementById('logout-btn').style.display='block';document.getElementById('user-info').innerHTML='👤 '+data.user.username;navigateTo('/')}else{document.getElementById('login-error').textContent=data.message||'Login failed'}}catch(err){document.getElementById('login-error').textContent='Error: '+err.message}}async function navigateTo(dir){if(!isLoggedIn)return;try{const res=await fetch('/api/fs/list?path='+encodeURIComponent(dir));const data=await res.json();if(data.error){document.getElementById('content').innerHTML='Error: '+data.error;return}document.getElementById('page-title').textContent='📁 '+(dir==='/'?'Home':data.path);let html='<div class="stats"><div class="stat-card"><div class="stat-label">📦 Total Files</div><div class="stat-value">'+data.items.length+'</div></div></div><div class="file-grid">';for(const item of data.items){html+='<div class="file-item" onclick="navigateTo(\\\''+dir+(dir.endsWith('/')?'':'/'+item.name+'\\\')"><div class="file-icon">'+item.icon+'</div><div class="file-name">'+item.name+'</div></div>'}html+='</div>';document.getElementById('content').innerHTML=html}catch(err){document.getElementById('content').innerHTML='Error: '+err.message}}function logout(){isLoggedIn=false;location.reload()}checkAuth()</script></body></html>`;
}

const server = http.createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🚀 FreeLang File Manager - Node.js Backend            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📍 주소: http://localhost:' + PORT + '/');
  console.log('👤 기본 계정: admin / admin');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ 포트 ' + PORT + '는 이미 사용 중입니다');
    process.exit(1);
  }
  throw err;
});
