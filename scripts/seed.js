#!/usr/bin/env node
import db from '../db.js';
import { randomBytes, scryptSync } from 'node:crypto';

function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }

const run = async () => {
  await db.exec(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), role TEXT);
  `);
  try {
    const email = 'jngempresa@gmail.com';
    const name = 'JNG Empresa';
    const password = 'jngempresa';
    const existing = await db.get('SELECT id FROM users WHERE email=$1', [email]);
    if (!existing) {
      await db.run("INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,'owner')", [name, email, passwordHash(password)]);
      console.log('Usuário criado:', email);
    } else {
      console.log('Usuário já existe.');
    }
  } catch (e) { console.error(e); process.exit(1); }
};

run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
