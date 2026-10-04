-- Конференции.РФ — схема БД
-- Создайте БД: CREATE DATABASE conferences;
-- Затем: psql -U postgres -d conferences -f schema.sql

DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  event_date DATE NOT NULL,
  payment VARCHAR(20) NOT NULL CHECK (payment IN ('cash', 'sbp')),
  status VARCHAR(50) NOT NULL DEFAULT 'Новая'
    CHECK (status IN ('Новая', 'Мероприятие назначено', 'Завершено')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO rooms (name) VALUES
  ('Аудитория'),
  ('Коворкинг'),
  ('Кинозал');

-- Админ Conf2027 / Demo77 создаётся при старте server.js (bcrypt)
