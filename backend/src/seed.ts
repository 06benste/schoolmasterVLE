import { db, runMigrations } from './db.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export function seedDatabase() {
  runMigrations();

  const email = 'admin@example.com';
  const username = 'admin';
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    console.log('Admin already exists');
    return;
  }

  const id = nanoid();
  const passwordHash = bcrypt.hashSync('Admin123!', 10);
  db.prepare('INSERT INTO users (id,username,email,password_hash,role,first_name,last_name,must_change_password) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, username, email, passwordHash, 'admin', 'Admin', 'User', 1);
  console.log('Seeded admin: username =', username, 'password: Admin123!');
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}



