/* ─────────────────────────────────────────────────────── */
/* HabitFlow - Backend Server (Express + SQLite)           */
/* Запуск: node server.js                                  */
/* ─────────────────────────────────────────────────────── */

const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT секрет — можно поменять на любую строку
const JWT_SECRET = 'habitflow-secret-key-2026-change-in-production';
const JWT_EXPIRES = '30d'; // токен живёт 30 дней

// ─── Инициализация БД ────────────────────────────────────
const DB_PATH = path.join(__dirname, 'prisma', 'habitflow.db');
const db = new Database(DB_PATH);

// WAL режим для лучшей производительности
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Создаём таблицы если не существуют
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: true, // разрешаем любой origin (для локальной разработки)
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Раздаём статические файлы (HTML/CSS/JS)
app.use(express.static(__dirname));

// ─── Middleware проверки JWT ──────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Prepared Statements ──────────────────────────────────
const stmts = {
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)'),
  getUserData: db.prepare('SELECT data FROM user_data WHERE user_id = ?'),
  upsertUserData: db.prepare(`
    INSERT INTO user_data (user_id, data, updated_at)
    VALUES (?, ?, strftime('%s', 'now'))
    ON CONFLICT(user_id) DO UPDATE SET
      data = excluded.data,
      updated_at = excluded.updated_at
  `)
};

// ─── AUTH ROUTES ──────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'fillAll' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'invalidEmail' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'passwordTooShort' });
    }

    // Проверяем уникальность email
    const existing = stmts.findUserByEmail.get(trimmedEmail);
    if (existing) {
      return res.status(409).json({ error: 'emailTaken' });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 12);

    // Создаём пользователя
    const result = stmts.createUser.run(trimmedEmail, passwordHash);
    const userId = result.lastInsertRowid;

    // Создаём пустые данные пользователя
    const defaultData = {
      email: trimmedEmail,
      settings: { theme: 'dark', colorScheme: 'emerald' },
      categories: [
        { id: 'cat-health', name: 'Health & Fitness 🏋️', order: 0, habits: [] },
        { id: 'cat-mind', name: 'Mind & Learning 📚', order: 1, habits: [] }
      ],
      habits: [
        { id: 'h-water', categoryId: 'cat-health', name: 'Drink Water 💧', order: 0, isPinned: true, isArchived: false },
        { id: 'h-exercise', categoryId: 'cat-health', name: 'Exercise 🏃', order: 1, isPinned: false, isArchived: false },
        { id: 'h-reading', categoryId: 'cat-mind', name: 'Read Book 📖', order: 0, isPinned: true, isArchived: false }
      ],
      logs: [],
      notes: {},
      monthlyGoals: [],
      yearlyGoals: []
    };
    stmts.upsertUserData.run(userId, JSON.stringify(defaultData));

    // Выдаём JWT токен
    const token = jwt.sign({ userId, email: trimmedEmail }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({ token, email: trimmedEmail, userId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'fillAll' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = stmts.findUserByEmail.get(trimmedEmail);
    if (!user) {
      return res.status(401).json({ error: 'invalidCredentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'invalidCredentials' });
    }

    const token = jwt.sign({ userId: user.id, email: trimmedEmail }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({ token, email: trimmedEmail, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me — проверить токен и получить email
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ userId: req.userId, email: req.userEmail });
});

// ─── DATA ROUTES ──────────────────────────────────────────

// GET /api/data — получить данные пользователя
app.get('/api/data', requireAuth, (req, res) => {
  try {
    const row = stmts.getUserData.get(req.userId);
    if (!row) {
      return res.status(404).json({ error: 'No data found' });
    }
    res.json(JSON.parse(row.data));
  } catch (err) {
    console.error('Get data error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/data — сохранить данные пользователя
app.put('/api/data', requireAuth, (req, res) => {
  try {
    const userData = req.body;
    if (!userData || typeof userData !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // Убедимся что email в данных совпадает с токеном
    userData.email = req.userEmail;

    stmts.upsertUserData.run(req.userId, JSON.stringify(userData));
    res.json({ success: true });
  } catch (err) {
    console.error('Save data error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Fallback: все статические файлы раздаём напрямую ────────────────
app.get('/{*splat}', (req, res) => {
  // Если запрашивается конкретный HTML файл — отдаём его
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Запуск ───────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ✅ HabitFlow сервер запущен!');
  console.log('');
  console.log(`  📱 Локально:    http://localhost:${PORT}`);
  console.log(`  🌐 По сети:     http://<твой-IP>:${PORT}`);
  console.log('');
  console.log('  Чтобы найти твой IP: ipconfig (Windows) или ifconfig (Mac/Linux)');
  console.log('  Введи этот адрес на другом устройстве в той же WiFi сети');
  console.log('');
});
