// ============================================================
// RAW BEAN Coffee - Backend Server
// Pure Node.js + JSON file storage, no npm dependencies
// Run: node server.js
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

// ---- Config ----
const PORT = 3000;
const SECRET = 'rawbean_coffee_secret_2026_xk9#m2p';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ---- Ensure data directory ----
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---- JSON file helpers ----
function readJSON(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}
function readJSONOne(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch { return null; }
}
function writeJSONOne(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

// ---- Auth helpers ----
function makeToken(email) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now(), exp: Date.now() + 7*24*3600*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}
function verifyToken(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const [h, p, s] = token.split('.');
    const expectSig = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
    if (s !== expectSig) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload.email;
  } catch { return null; }
}
function isAdmin(email) {
  const users = readJSON('users.json');
  const u = users.find(u => u.email === email);
  return u && u.isAdmin;
}

// ---- CORS ----
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}
function sendJSON(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function sendError(res, status, message) {
  sendJSON(res, status, { error: message });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// ---- Init default data ----
function initData() {
  // Admin user
  let users = readJSON('users.json');
  if (!users.find(u => u.email === 'admin@rawbean.com')) {
    users.push({
      id: 'u_admin_001',
      email: 'admin@rawbean.com',
      passwordHash: crypto.createHash('sha256').update('admin123' + SECRET).digest('hex'),
      name: 'RAW BEAN 管理员',
      phone: '13800138000',
      isAdmin: true,
      createdAt: new Date().toISOString()
    });
    writeJSON('users.json', users);
    console.log('✅ Admin created: admin@rawbean.com / admin123');
  }

  // Default products (if empty)
  let products = readJSON('products.json');
  if (products.length === 0) {
    products = [
      { id:'p_ethiopia', name:'日出耶加', nameEn:'Sunrise Yirgacheffe', origin:'埃塞俄比亚 · 耶加雪菲 · 日晒', price:89, category:'single', badge:'热门', sca:89, altitude:'2100m', process:'日晒', roast:'浅中焙', flavorJson:'{"蓝莓":9,"茉莉":8,"蜂蜜":7,"柠檬":6,"佛手柑":5}', desc:'SCA 89分。海拔2100m，日照充足。蓝莓与茉莉的爆炸组合，尾韵蜂蜜甜感持久。适合手冲，水温92°C，粉水比1:15。', brewJson:'{"粉水比":"1:15","水温":"92°C","时间":"2:30","推荐器具":"V60滤杯"}', img:'https://picsum.photos/seed/coffee-eth/800/500', createdAt:new Date().toISOString() },
      { id:'p_colombia', name:'慧兰之心', nameEn:'Huila Heart', origin:'哥伦比亚 · 慧兰 · 水洗', price:79, category:'single', badge:'经典', sca:87, altitude:'1800m', process:'水洗', roast:'中焙', flavorJson:'{"巧克力":9,"坚果":8,"红苹果":7,"焦糖":6,"奶油":5}', desc:'SCA 87分。海拔1800m，水洗处理带来极致干净度。巧克力与坚果的经典组合，尾韵红苹果酸质明亮。', brewJson:'{"粉水比":"1:14","水温":"90°C","时间":"2:15","推荐器具":"法压壶"}', img:'https://picsum.photos/seed/coffee-col/800/500', createdAt:new Date().toISOString() },
      { id:'p_yunnan', name:'普洱夜曲', nameEn:'Pu\'er Nocturne', origin:'中国 · 云南普洱 · 厌氧', price:69, category:'single', badge:'国产之光', sca:86, altitude:'1600m', process:'厌氧', roast:'中深焙', flavorJson:'{"红酒":9,"黑巧克力":8,"烟熏":6,"陈皮":7,"乌龙茶":5}', desc:'SCA 86分。海拔1600m，厌氧处理72小时。红酒与黑巧克力的深度组合，尾韵陈皮回甘悠长。', brewJson:'{"粉水比":"1:12","水温":"94°C","时间":"4:00","推荐器具":"法压壶"}', img:'https://picsum.photos/seed/coffee-yn/800/500', createdAt:new Date().toISOString() },
      { id:'p_kenya', name:'肯尼亚之光', nameEn:'Kenya Glow', origin:'肯尼亚 · 涅里 · 双重水洗', price:99, category:'single', badge:'稀缺', sca:90, altitude:'1900m', process:'双重水洗', roast:'浅焙', flavorJson:'{"黑加仑":9,"番茄":7,"葡萄柚":8,"烟熏":"6","乌梅":7}', desc:'SCA 90分。海拔1900m，双重水洗处理。黑加仑与番茄的酸质炸弹，尾韵乌梅甘甜。', brewJson:'{"粉水比":"1:16","水温":"93°C","时间":"2:45","推荐器具":"手冲V60"}', img:'https://picsum.photos/seed/coffee-ken/800/500', createdAt:new Date().toISOString() },
      { id:'p_blend_morning', name:'晨曦序曲', nameEn:'Morning Overture', origin:'巴西+哥伦比亚 · 拼配', price:59, category:'blend', badge:'早间推荐', sca:85, altitude:'1100-1800m', process:'半水洗+日晒', roast:'中焙', flavorJson:'{"焦糖":9,"坚果":8,"牛奶":7,"可可":6,"甜感":8}', desc:'早间拼配，巴西甜感基底+哥伦比亚亮度点缀。牛奶融入后焦糖坚果爆发，开启完美一天。', brewJson:'{"粉水比":"1:13","水温":"91°C","时间":"2:20","推荐器具":"爱乐压"}', img:'https://picsum.photos/seed/coffee-mor/800/500', createdAt:new Date().toISOString() },
      { id:'p_blend_night', name:'暗夜交响', nameEn:'Dark Symphony', origin:'印尼+越南 · 拼配', price:65, category:'blend', badge:'意式首选', sca:84, altitude:'900-1500m', process:'湿刨法+罗布斯塔', roast:'深焙', flavorJson:'{"醇厚":9,"奶油":8,"黑巧克力":8,"烟丝":6,"焦糖":7}', desc:'深烘焙拼配，印尼湿刨法带来醇厚body，越南罗布斯塔提供咖啡因冲击力。意式浓缩完美基底。', brewJson:'{"粉水比":"1:11","水温":"94°C","时间":"2:00","推荐器具":"意式机"}', img:'https://picsum.photos/seed/coffee-nit/800/500', createdAt:new Date().toISOString() },
      { id:'p_geisha', name:'瑰夏幻境', nameEn:'Geisha Mirage', origin:'巴拿马 · 翡翠庄园 · 水洗', price:199, category:'limited', badge:'限量', sca:94, altitude:'1900m', process:'水洗', roast:'极浅焙', flavorJson:'{"茉莉":10,"佛手柑":9,"蜂蜜":8,"伯爵茶":7,"柠檬草":6}', desc:'SCA 94分。巴拿马翡翠庄园，2025年竞标批次。茉莉与佛手柑的交响诗，尾韵伯爵茶悠然绵长。全球限量30kg。', brewJson:'{"粉水比":"1:17","水温":"89°C","时间":"3:00","推荐器具":"手冲Chemex"}', img:'https://picsum.photos/seed/coffee-gei/800/500', createdAt:new Date().toISOString() }
    ];
    writeJSON('products.json', products);
    console.log('✅ Default products created');
  }

  // Settings
  let settings = readJSONOne('settings.json');
  if (!settings) {
    writeJSONOne('settings.json', {
      siteName: 'RAW BEAN COFFEE',
      currency: 'CNY',
      freeShippingThreshold: 199,
      contactEmail: 'hello@rawbean.com',
      contactPhone: '400-888-1234',
      address: '上海市静安区RAW BEAN烘焙工坊',
      announcement: '🎉 新用户注册即送50元优惠券！',
      updatedAt: new Date().toISOString()
    });
  }
}
initData();

// ---- Request Router ----
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ---- Static file serving (GET only) ----
  if (method === 'GET' && !pathname.startsWith('/api/')) {
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      return sendError(res, 403, 'Forbidden');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2' };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        setCORS(res);
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch { /* fall through to 404 */ }
  }

  // ---- Health check ----
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, { status: 'ok', time: new Date().toISOString() });
  }

  // ---- AUTH: Register ----
  if (pathname === '/api/register' && method === 'POST') {
    const body = await readBody(req);
    if (!body.email || !body.password || !body.name) return sendError(res, 400, '缺少必填字段');
    const users = readJSON('users.json');
    if (users.find(u => u.email === body.email)) return sendError(res, 409, '邮箱已注册');
    const newUser = {
      id: 'u_' + crypto.randomBytes(6).toString('hex'),
      email: body.email,
      passwordHash: crypto.createHash('sha256').update(body.password + SECRET).digest('hex'),
      name: body.name,
      phone: body.phone || '',
      avatar: '',
      isAdmin: false,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeJSON('users.json', users);
    const token = makeToken(newUser.email);
    const { passwordHash, ...safeUser } = newUser;
    return sendJSON(res, 201, { token, user: safeUser });
  }

  // ---- AUTH: Login ----
  if (pathname === '/api/login' && method === 'POST') {
    const body = await readBody(req);
    if (!body.email || !body.password) return sendError(res, 400, '缺少邮箱或密码');
    const users = readJSON('users.json');
    const hash = crypto.createHash('sha256').update(body.password + SECRET).digest('hex');
    const user = users.find(u => u.email === body.email && u.passwordHash === hash);
    if (!user) return sendError(res, 401, '邮箱或密码错误');
    const token = makeToken(user.email);
    const { passwordHash, ...safeUser } = user;
    return sendJSON(res, 200, { token, user: safeUser });
  }

  // ---- AUTH: Get current user ----
  if (pathname === '/api/me' && method === 'GET') {
    const email = verifyToken(req);
    if (!email) return sendError(res, 401, '未登录');
    const users = readJSON('users.json');
    const user = users.find(u => u.email === email);
    if (!user) return sendError(res, 401, '用户不存在');
    const { passwordHash, ...safeUser } = user;
    return sendJSON(res, 200, safeUser);
  }

  // ---- AUTH: Update profile ----
  if (pathname === '/api/me' && method === 'PUT') {
    const email = verifyToken(req);
    if (!email) return sendError(res, 401, '未登录');
    const body = await readBody(req);
    const users = readJSON('users.json');
    const idx = users.findIndex(u => u.email === email);
    if (idx < 0) return sendError(res, 401, '用户不存在');
    if (body.name !== undefined) users[idx].name = body.name;
    if (body.phone !== undefined) users[idx].phone = body.phone;
    if (body.avatar !== undefined) users[idx].avatar = body.avatar;
    if (body.password && body.password.length >= 6) {
      users[idx].passwordHash = crypto.createHash('sha256').update(body.password + SECRET).digest('hex');
    }
    writeJSON('users.json', users);
    const { passwordHash, ...safeUser } = users[idx];
    return sendJSON(res, 200, safeUser);
  }

  // ============== PUBLIC PRODUCTS ==============
  // ---- GET all products ----
  if (pathname === '/api/products' && method === 'GET') {
    const products = readJSON('products.json');
    const { passwordHash, ...safe } = {};
    return sendJSON(res, 200, products.map(p => { const { passwordHash, ...rest } = p; return rest; }));
  }

  // ---- GET single product ----
  if (/^\/api\/products\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'GET') {
    const id = pathname.split('/')[3];
    const products = readJSON('products.json');
    const p = products.find(p => p.id === id);
    if (!p) return sendError(res, 404, '产品不存在');
    const { passwordHash, ...safe } = p;
    return sendJSON(res, 200, safe);
  }

  // ============== ORDERS ==============
  // ---- CREATE order (user) ----
  if (pathname === '/api/orders' && method === 'POST') {
    const email = verifyToken(req);
    if (!email) return sendError(res, 401, '请先登录');
    const body = await readBody(req);
    if (!body.items || !body.shippingAddress || !body.paymentMethod) return sendError(res, 400, '缺少订单信息');
    const orders = readJSON('orders.json');
    const newOrder = {
      id: 'ORD' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase(),
      userEmail: email,
      items: body.items,
      total: body.total,
      shippingAddress: body.shippingAddress,
      paymentMethod: body.paymentMethod,
      status: 'pending_payment', // pending_payment, paid, processing, shipped, delivered, cancelled
      statusHistory: [{ status: 'pending_payment', time: new Date().toISOString(), note: '订单已创建' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    orders.push(newOrder);
    writeJSON('orders.json', orders);
    return sendJSON(res, 201, newOrder);
  }

  // ---- GET my orders ----
  if (pathname === '/api/orders/my' && method === 'GET') {
    const email = verifyToken(req);
    if (!email) return sendError(res, 401, '请先登录');
    const orders = readJSON('orders.json');
    const myOrders = orders.filter(o => o.userEmail === email).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, myOrders);
  }

  // ============== ADMIN ROUTES ==============
  // ---- ADMIN: Get all orders ----
  if (pathname === '/api/admin/orders' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const orders = readJSON('orders.json');
    const { status, search, startDate, endDate } = parsedUrl.query;
    let filtered = orders;
    if (status) filtered = filtered.filter(o => o.status === status);
    if (search) filtered = filtered.filter(o => o.id.includes(search) || o.userEmail.includes(search));
    if (startDate) filtered = filtered.filter(o => o.createdAt >= startDate);
    if (endDate) filtered = filtered.filter(o => o.createdAt <= endDate);
    filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, filtered);
  }

  // ---- ADMIN: Get single order ----
  if (/^\/api\/admin\/orders\/[A-Za-z0-9]+$/.test(pathname) && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const orderId = pathname.split('/')[4];
    const orders = readJSON('orders.json');
    const order = orders.find(o => o.id === orderId);
    if (!order) return sendError(res, 404, '订单不存在');
    return sendJSON(res, 200, order);
  }

  // ---- ADMIN: Update order status ----
  if (/^\/api\/admin\/orders\/[A-Za-z0-9]+\/status$/.test(pathname) && method === 'PUT') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const orderId = pathname.split('/')[4];
    const body = await readBody(req);
    const orders = readJSON('orders.json');
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx < 0) return sendError(res, 404, '订单不存在');
    const oldStatus = orders[idx].status;
    orders[idx].status = body.status || orders[idx].status;
    orders[idx].updatedAt = new Date().toISOString();
    orders[idx].statusHistory.push({
      status: body.status || oldStatus,
      time: new Date().toISOString(),
      note: body.note || `状态从 ${oldStatus} 更新为 ${body.status || oldStatus}`
    });
    writeJSON('orders.json', orders);
    return sendJSON(res, 200, orders[idx]);
  }

  // ---- ADMIN: Delete order ----
  if (/^\/api\/admin\/orders\/[A-Za-z0-9]+$/.test(pathname) && method === 'DELETE') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const orderId = pathname.split('/')[4];
    let orders = readJSON('orders.json');
    orders = orders.filter(o => o.id !== orderId);
    writeJSON('orders.json', orders);
    return sendJSON(res, 200, { success: true });
  }

  // ============== ADMIN: USERS ==============
  if (pathname === '/api/admin/users' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const users = readJSON('users.json');
    const safe = users.map(u => { const { passwordHash, ...rest } = u; return rest; });
    return sendJSON(res, 200, safe);
  }
  if (/^\/api\/admin\/users\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const uid = pathname.split('/')[4];
    const users = readJSON('users.json');
    const u = users.find(u => u.id === uid);
    if (!u) return sendError(res, 404, '用户不存在');
    const { passwordHash, ...safe } = u;
    return sendJSON(res, 200, safe);
  }
  if (/^\/api\/admin\/users\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'PUT') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const uid = pathname.split('/')[4];
    const body = await readBody(req);
    const users = readJSON('users.json');
    const idx = users.findIndex(u => u.id === uid);
    if (idx < 0) return sendError(res, 404, '用户不存在');
    if (body.name !== undefined) users[idx].name = body.name;
    if (body.phone !== undefined) users[idx].phone = body.phone;
    if (body.isAdmin !== undefined) users[idx].isAdmin = body.isAdmin;
    writeJSON('users.json', users);
    const { passwordHash, ...safe } = users[idx];
    return sendJSON(res, 200, safe);
  }
  if (/^\/api\/admin\/users\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'DELETE') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const uid = pathname.split('/')[4];
    let users = readJSON('users.json');
    users = users.filter(u => u.id !== uid);
    writeJSON('users.json', users);
    return sendJSON(res, 200, { success: true });
  }

  // ============== ADMIN: PRODUCTS ==============
  if (pathname === '/api/admin/products' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    return sendJSON(res, 200, readJSON('products.json'));
  }
  if (pathname === '/api/admin/products' && method === 'POST') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const body = await readBody(req);
    const products = readJSON('products.json');
    const newP = { id: 'p_' + crypto.randomBytes(4).toString('hex'), ...body, createdAt: new Date().toISOString() };
    products.push(newP);
    writeJSON('products.json', products);
    return sendJSON(res, 201, newP);
  }
  if (/^\/api\/admin\/products\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'PUT') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const pid = pathname.split('/')[4];
    const body = await readBody(req);
    const products = readJSON('products.json');
    const idx = products.findIndex(p => p.id === pid);
    if (idx < 0) return sendError(res, 404, '产品不存在');
    Object.assign(products[idx], body, { updatedAt: new Date().toISOString() });
    writeJSON('products.json', products);
    return sendJSON(res, 200, products[idx]);
  }
  if (/^\/api\/admin\/products\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'DELETE') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const pid = pathname.split('/')[4];
    let products = readJSON('products.json');
    products = products.filter(p => p.id !== pid);
    writeJSON('products.json', products);
    return sendJSON(res, 200, { success: true });
  }

  // ============== ADMIN: SURVEYS ==============
  if (pathname === '/api/admin/surveys' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    return sendJSON(res, 200, readJSON('surveys.json'));
  }
  if (/^\/api\/admin\/surveys\/[a-zA-Z0-9_]+$/.test(pathname) && method === 'DELETE') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const sid = pathname.split('/')[4];
    let surveys = readJSON('surveys.json');
    surveys = surveys.filter(s => s.id !== sid);
    writeJSON('surveys.json', surveys);
    return sendJSON(res, 200, { success: true });
  }
  if (pathname === '/api/admin/surveys/export' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const surveys = readJSON('surveys.json');
    if (surveys.length === 0) return sendError(res, 404, '暂无数据');
    const headers = Object.keys(surveys[0].answers);
    const csvRows = [['ID','提交时间',...headers].join(',')];
    surveys.forEach(s => {
      csvRows.push([s.id, s.submittedAt, ...headers.map(h => JSON.stringify(s.answers[h] ?? ''))].join(','));
    });
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="surveys_export.csv"'
    });
    return res.end('\uFEFF' + csvRows.join('\n'));
  }

  // ============== ADMIN: STATS ==============
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const orders = readJSON('orders.json');
    const users = readJSON('users.json');
    const products = readJSON('products.json');
    const surveys = readJSON('surveys.json');

    const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
    const totalOrders = orders.length;
    const totalUsers = users.filter(u => !u.isAdmin).length;
    const totalProducts = products.length;

    // Revenue by day (last 7 days)
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(key) && o.status !== 'cancelled');
      last7.push({ date: key, revenue: dayOrders.reduce((s, o) => s + o.total, 0), count: dayOrders.length });
    }

    // Orders by status
    const statusCounts = {};
    orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

    // Top products
    const productSales = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(productSales).map(([pid, qty]) => {
      const p = products.find(p => p.id === pid);
      return { id: pid, name: p ? p.name : pid, qty };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return sendJSON(res, 200, {
      totalRevenue, totalOrders, totalUsers, totalProducts,
      last7Days: last7, statusCounts, topProducts,
      totalSurveys: surveys.length
    });
  }

  // ============== ADMIN: SETTINGS ==============
  if (pathname === '/api/admin/settings' && method === 'GET') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    return sendJSON(res, 200, readJSONOne('settings.json'));
  }
  if (pathname === '/api/admin/settings' && method === 'PUT') {
    const email = verifyToken(req);
    if (!email || !isAdmin(email)) return sendError(res, 403, '无权限');
    const body = await readBody(req);
    const settings = readJSONOne('settings.json') || {};
    Object.assign(settings, body, { updatedAt: new Date().toISOString() });
    writeJSONOne('settings.json', settings);
    return sendJSON(res, 200, settings);
  }

  // ============== SURVEY SUBMIT (public) ==============
  if (pathname === '/api/surveys' && method === 'POST') {
    const body = await readBody(req);
    if (!body.answers) return sendError(res, 400, '缺少问卷数据');
    const surveys = readJSON('surveys.json');
    surveys.push({
      id: 'svy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      answers: body.answers,
      submittedAt: new Date().toISOString(),
      userEmail: body.userEmail || null
    });
    writeJSON('surveys.json', surveys);
    return sendJSON(res, 201, { success: true });
  }

  // ---- 404 ----
  setCORS(res);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 RAW BEAN Backend running at http://localhost:${PORT}`);
  console.log(`   Admin: admin@rawbean.com / admin123`);
  console.log(`   API Health: http://localhost:${PORT}/api/health\n`);
});
