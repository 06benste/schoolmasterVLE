import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { signToken } from '../auth.js';

export const authRoutes = Router();

authRoutes.post('/register', (req, res) => {
  const { username, email, password, role, firstName, lastName } = req.body as {
    username?: string; email?: string; password: string; role: 'admin'|'teacher'|'student'; firstName?: string; lastName?: string;
  };
  if ((!username && !email) || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  const id = nanoid();
  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (id,username,email,password_hash,role,first_name,last_name,must_change_password) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, username ?? (email ? email.toLowerCase().split('@')[0] : null), email ? email.toLowerCase() : null, passwordHash, role, firstName ?? null, lastName ?? null, 1);
    res.json({ id, username, email, role });
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'User already exists' });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

authRoutes.post('/login', (req, res) => {
  const { username, email, password } = req.body as { username?: string; email?: string; password: string };
  const row = db
    .prepare('SELECT id, username, email, password_hash, role, first_name, last_name, must_change_password FROM users WHERE ((LOWER(username) = LOWER(@u)) OR (LOWER(email) = LOWER(@e))) AND archived = 0')
    .get({ u: username ?? '', e: email ?? '' }) as
    | { id: string; username?: string; email?: string; password_hash: string; role: 'admin'|'teacher'|'student'; first_name?: string; last_name?: string; must_change_password: number }
    | undefined;
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(row.id, row.role);
  res.json({ 
    token, 
    user: { 
      id: row.id, 
      role: row.role, 
      firstName: row.first_name, 
      lastName: row.last_name, 
      username: row.username, 
      email: row.email,
      mustChangePassword: !!row.must_change_password
    } 
  });
});

// Change password endpoint
authRoutes.post('/change-password', (req, res) => {
  const { currentPassword, newPassword, userId } = req.body as { 
    currentPassword: string; 
    newPassword: string; 
    userId: string; 
  };
  
  if (!currentPassword || !newPassword || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get user and verify current password
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isCurrentPasswordValid) return res.status(401).json({ error: 'Current password is incorrect' });

  // Update password and clear must_change_password flag
  const newPasswordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(newPasswordHash, userId);
  
  res.json({ message: 'Password changed successfully' });
});



