import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from './db.js';
import {
  validateRegister,
  validateLogin,
  validateApplication,
} from './validation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const STATUSES = ['Новая', 'Мероприятие назначено', 'Завершено'];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.formatDate = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.is_admin) {
    return res.status(403).send('Доступ только для администратора');
  }
  next();
}

async function ensureAdmin() {
  const { rows } = await query('SELECT id FROM users WHERE login = $1', [
    'Conf2027',
  ]);
  if (rows.length) return;

  const hash = await bcrypt.hash('Demo77', 10);
  await query(
    `INSERT INTO users (login, password_hash, full_name, phone, email, is_admin)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    ['Conf2027', hash, 'Администратор Системы', '8(900)000-00-00', 'admin@conf.rf']
  );
  console.log('Админ создан: Conf2027 / Demo77');
}

// ---------- Главная ----------
app.get('/', (req, res) => {
  if (req.session.user?.is_admin) return res.redirect('/admin');
  if (req.session.user) return res.redirect('/applications');
  res.redirect('/login');
});

// ---------- Регистрация ----------
app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { errors: {}, values: {} });
});

app.post('/register', async (req, res) => {
  const values = {
    login: req.body.login?.trim() || '',
    password: req.body.password || '',
    full_name: req.body.full_name?.trim() || '',
    phone: req.body.phone?.trim() || '',
    email: req.body.email?.trim() || '',
  };
  const errors = validateRegister(values);
  if (Object.keys(errors).length) {
    return res.render('register', { errors, values });
  }

  try {
    const hash = await bcrypt.hash(values.password, 10);
    await query(
      `INSERT INTO users (login, password_hash, full_name, phone, email)
       VALUES ($1, $2, $3, $4, $5)`,
      [values.login, hash, values.full_name, values.phone, values.email]
    );
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      errors.login = 'Логин уже занят';
      return res.render('register', { errors, values });
    }
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

// ---------- Вход ----------
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, values: {} });
});

app.post('/login', async (req, res) => {
  const values = {
    login: req.body.login?.trim() || '',
    password: req.body.password || '',
  };
  const fieldErrors = validateLogin(values);
  if (Object.keys(fieldErrors).length) {
    return res.render('login', {
      error: 'Заполните логин и пароль',
      values,
    });
  }

  const { rows } = await query('SELECT * FROM users WHERE login = $1', [
    values.login,
  ]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(values.password, user.password_hash));

  if (!ok) {
    return res.render('login', {
      error: 'Неверный логин или пароль',
      values,
    });
  }

  req.session.user = {
    id: user.id,
    login: user.login,
    is_admin: user.is_admin,
  };
  res.redirect(user.is_admin ? '/admin' : '/applications');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- Мои заявки ----------
app.get('/applications', requireAuth, async (req, res) => {
  if (req.session.user.is_admin) return res.redirect('/admin');

  const { rows } = await query(
    `SELECT a.*, r.name AS room_name, rev.text AS review_text, rev.id AS review_id
     FROM applications a
     JOIN rooms r ON r.id = a.room_id
     LEFT JOIN reviews rev ON rev.application_id = a.id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [req.session.user.id]
  );

  res.render('applications', {
    applications: rows,
    message: req.query.message || null,
    error: req.query.error || null,
  });
});

app.get('/applications/new', requireAuth, async (req, res) => {
  if (req.session.user.is_admin) return res.redirect('/admin');
  const { rows: rooms } = await query('SELECT * FROM rooms ORDER BY id');
  res.render('new-application', { rooms, errors: {}, values: {} });
});

app.post('/applications/new', requireAuth, async (req, res) => {
  if (req.session.user.is_admin) return res.redirect('/admin');

  const values = {
    room_id: req.body.room_id || '',
    event_date: req.body.event_date || '',
    payment: req.body.payment || '',
  };
  const errors = validateApplication(values);
  const { rows: rooms } = await query('SELECT * FROM rooms ORDER BY id');

  if (Object.keys(errors).length) {
    return res.render('new-application', { rooms, errors, values });
  }

  await query(
    `INSERT INTO applications (user_id, room_id, event_date, payment, status)
     VALUES ($1, $2, $3, $4, 'Новая')`,
    [req.session.user.id, values.room_id, values.event_date, values.payment]
  );
  res.redirect('/applications?message=Заявка отправлена');
});

app.post('/applications/:id/review', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const text = (req.body.text || '').trim();

  if (!text) {
    return res.redirect('/applications?error=Введите текст отзыва');
  }

  const { rows } = await query(
    'SELECT * FROM applications WHERE id = $1 AND user_id = $2',
    [id, req.session.user.id]
  );
  const appRow = rows[0];

  if (!appRow) {
    return res.redirect('/applications?error=Заявка не найдена');
  }
  if (appRow.status !== 'Завершено') {
    return res.redirect(
      '/applications?error=Отзыв можно оставить только при статусе «Завершено»'
    );
  }

  try {
    await query(
      'INSERT INTO reviews (application_id, text) VALUES ($1, $2)',
      [id, text]
    );
    res.redirect('/applications?message=Отзыв сохранён');
  } catch (err) {
    if (err.code === '23505') {
      return res.redirect('/applications?error=Отзыв уже оставлен');
    }
    console.error(err);
    res.redirect('/applications?error=Ошибка сохранения отзыва');
  }
});

// ---------- Админка ----------
app.get('/admin', requireAdmin, async (req, res) => {
  const statusFilter = req.query.status || '';
  let sql = `
    SELECT a.*, r.name AS room_name, u.login, u.full_name, u.phone, u.email,
           rev.text AS review_text
    FROM applications a
    JOIN rooms r ON r.id = a.room_id
    JOIN users u ON u.id = a.user_id
    LEFT JOIN reviews rev ON rev.application_id = a.id`;
  const params = [];

  if (statusFilter && STATUSES.includes(statusFilter)) {
    params.push(statusFilter);
    sql += ` WHERE a.status = $1`;
  }
  sql += ' ORDER BY a.created_at DESC';

  const { rows } = await query(sql, params);
  res.render('admin', {
    applications: rows,
    statuses: STATUSES,
    statusFilter,
    message: req.query.message || null,
  });
});

app.post('/admin/applications/:id/status', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status || '';

  if (!STATUSES.includes(status)) {
    return res.redirect('/admin?message=Некорректный статус');
  }

  await query('UPDATE applications SET status = $1 WHERE id = $2', [
    status,
    id,
  ]);

  const params = new URLSearchParams();
  if (req.body.filter) params.set('status', req.body.filter);
  params.set('message', 'Статус обновлён');
  res.redirect(`/admin?${params.toString()}`);
});

// ---------- Старт ----------
async function start() {
  try {
    await ensureAdmin();
    app.listen(PORT, () => {
      console.log(`http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Не удалось подключиться к БД. Проверьте .env и schema.sql');
    console.error(err.message);
    process.exit(1);
  }
}

start();
