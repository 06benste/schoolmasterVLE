import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.SQLITE_DB_PATH || './data/app.db';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

export function runMigrations() {
  const schema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
    first_name TEXT,
    last_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived INTEGER DEFAULT 0,
    archived_at TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived INTEGER DEFAULT 0,
    archived_at TEXT,
    auto_archive_date TEXT,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS class_students (
    class_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    PRIMARY KEY (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lesson','assessment')),
    ref_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    due_at TEXT,
    max_attempts INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS topic_lessons (
    topic_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (topic_id, lesson_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignment_targets (
    assignment_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('class','student')),
    target_id TEXT NOT NULL,
    PRIMARY KEY (assignment_id, target_type, target_id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    score REAL,
    max_score REAL,
    submitted_at TEXT,
    data_json TEXT,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignment_progress (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    data_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS assignment_access (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS course_assignments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('student', 'class')),
    target_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS topic_assignments (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('student', 'class')),
    target_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `;

  db.exec(schema);

  // Add max_attempts column to assignments table if it doesn't exist
  try {
    db.exec("ALTER TABLE assignments ADD COLUMN max_attempts INTEGER");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding max_attempts column:', err);
    }
  }

  // Attempt to backfill username for legacy rows
  try {
    db.exec("UPDATE users SET username = COALESCE(username, CASE WHEN instr(email,'@')>0 THEN substr(email,1,instr(email,'@')-1) ELSE email END)");
  } catch (err) {
    console.error('Error backfilling username:', err);
  }

  // Add must_change_password column to users table if it doesn't exist
  try {
    db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding must_change_password column:', err);
    }
  }

  // Add archive columns to users table if they don't exist
  try {
    db.exec("ALTER TABLE users ADD COLUMN archived INTEGER DEFAULT 0");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding archived column:', err);
    }
  }
  
  try {
    db.exec("ALTER TABLE users ADD COLUMN archived_at TEXT");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding archived_at column:', err);
    }
  }

  // Add archive columns to classes table if they don't exist
  try {
    db.exec("ALTER TABLE classes ADD COLUMN archived INTEGER DEFAULT 0");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding archived column to classes:', err);
    }
  }
  
  try {
    db.exec("ALTER TABLE classes ADD COLUMN archived_at TEXT");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding archived_at column to classes:', err);
    }
  }
  
  try {
    db.exec("ALTER TABLE classes ADD COLUMN auto_archive_date TEXT");
  } catch (err: any) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding auto_archive_date column:', err);
    }
  }
}



