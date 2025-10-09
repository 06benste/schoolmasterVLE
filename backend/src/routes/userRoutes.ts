import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { requireAuth, requireRole } from '../auth.js';
import multer from 'multer';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

export const userRoutes = Router();

// Generate a random temporary password
function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  // Ensure at least one of each character type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Add remaining random characters (total length: 12)
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Configure multer for CSV file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Simple in-memory job tracker for async CSV imports
type ImportJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
interface ImportJob {
  id: string
  status: ImportJobStatus
  total: number
  current: number
  messages: string[]
  errors: string[]
  startedAt: number
  finishedAt?: number
  result?: {
    createdCount: number
    errorCount: number
    classesCreatedCount: number
    createdUsers?: Array<{username: string, password: string, name: string, surname: string}>
  }
  error?: string
}

const importJobs = new Map<string, ImportJob>()

function pushJobMessage(job: ImportJob, message: string) {
  job.messages.push(message)
  if (job.messages.length > 200) job.messages.shift()
}

function pushJobError(job: ImportJob, error: string) {
  job.errors.push(error)
  if (job.errors.length > 100) job.errors.shift()
}

// Ensure imports directory exists
const importsDir = path.join(process.cwd(), 'data', 'imports')
try { if (!fs.existsSync(importsDir)) fs.mkdirSync(importsDir, { recursive: true }) } catch {}

// Helper function to parse dd/mm/yyyy date format
function parseDDMMYYYY(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  // Validate date
  if (date.getDate() !== parseInt(day) || date.getMonth() !== parseInt(month) - 1 || date.getFullYear() !== parseInt(year)) {
    return null;
  }
  return date.toISOString();
}

// Start processing helper: reads from file and processes in small batches with yielding
async function startCsvProcessing(jobId: string) {
  const job = importJobs.get(jobId)
  if (!job || !(job as any).filePath) return
  const filePath = (job as any).filePath as string
  try {
    job.status = 'processing'
    pushJobMessage(job, 'Reading CSV from storage...')

    // Stream rows to an array to know total count first (alternatively could pre-count lines)
    const rows: any[] = []
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject)
    })
    job.total = rows.length
    pushJobMessage(job, `Parsed ${job.total} rows. Beginning import...`)

    // Get all existing classes for validation
    const classes = db.prepare('SELECT id, name FROM classes').all() as Array<{id: string, name: string}>
    const classMap = new Map(classes.map(c => [c.name.toLowerCase(), c.id]))

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, must_change_password, archived, archived_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 1, ?, ?)
    `)
    
    const insertClass = db.prepare(`
      INSERT INTO classes (id, name, teacher_id, auto_archive_date, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `)
    
    const insertClassStudent = db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)')

    let createdCount = 0
    let errorCount = 0
    let classesCreatedCount = 0
    const createdUsers: Array<{username: string, password: string, name: string, surname: string}> = []
    const batchSize = 25
    const totalBatches = Math.ceil(rows.length / batchSize)
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // Check if job was cancelled (type assertion needed as job can be mutated externally)
      if ((job.status as ImportJobStatus) === 'cancelled') {
        pushJobMessage(job, 'Import cancelled by user')
        job.finishedAt = Date.now()
        job.result = { createdCount, errorCount, classesCreatedCount, createdUsers }
        return
      }

      const startIndex = batchIndex * batchSize
      const endIndex = Math.min(startIndex + batchSize, rows.length)
      const batch = rows.slice(startIndex, endIndex)
      pushJobMessage(job, `Processing batch ${batchIndex + 1}/${totalBatches} (rows ${startIndex + 1}-${endIndex})`)

      const tx = db.transaction(() => {
        for (let i = 0; i < batch.length; i++) {
          const row = batch[i]
          const rowNum = startIndex + i + 1
          const { name, surname, username, email, archive_date, class1, class2, class3, class4, class5, class6, class7, class8, class9, class10 } = row
          if (!name || !surname || !username) {
            errorCount++
            pushJobError(job, `Row ${rowNum}: Missing required fields (name, surname, or username)`)
            continue
          }
          
          // Use email if provided, otherwise fall back to username
          const userEmail = email && email.trim() ? email.trim().toLowerCase() : username
          
          const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, userEmail)
          if (exists) {
            errorCount++
            pushJobError(job, `Row ${rowNum}: User "${username}" or email "${userEmail}" already exists`)
            continue
          }
          try {
            const id = nanoid()
            const tempPassword = generateTempPassword()
            const passwordHash = bcrypt.hashSync(tempPassword, 10)
            
            // Parse archive date if provided
            let archived = 0
            let archivedAt = null
            if (archive_date && archive_date.trim()) {
              const parsedDate = parseDDMMYYYY(archive_date)
              if (parsedDate) {
                archived = 1
                archivedAt = parsedDate
              } else {
                pushJobError(job, `Row ${rowNum}: Invalid archive date format "${archive_date}" (expected dd/mm/yyyy)`)
              }
            }
            
            insertUser.run(id, username, userEmail, passwordHash, name, surname, archived, archivedAt)
            createdCount++
            
            // Track created user with password for CSV download
            createdUsers.push({ username, password: tempPassword, name, surname })

            // Assign to classes
            const classColumns = [class1, class2, class3, class4, class5, class6, class7, class8, class9, class10]
            for (const className of classColumns) {
              if (className && className.trim()) {
                const trimmedClassName = className.trim()
                let classId = classMap.get(trimmedClassName.toLowerCase())
                
                // Create class if it doesn't exist
                if (!classId) {
                  try {
                    const newClassId = nanoid()
                    const oneYearFromNow = new Date()
                    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
                    const autoArchiveDate = oneYearFromNow.toISOString().split('T')[0]
                    
                    // Get the first admin user as default teacher
                    const defaultTeacher = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') as { id: string } | undefined
                    if (!defaultTeacher) {
                      pushJobError(job, `Row ${rowNum}: No admin user found to assign as teacher for class "${trimmedClassName}"`)
                      continue
                    }
                    
                    insertClass.run(newClassId, trimmedClassName, defaultTeacher.id, autoArchiveDate)
                    
                    classId = newClassId
                    classMap.set(trimmedClassName.toLowerCase(), classId)
                    classesCreatedCount++
                    pushJobMessage(job, `Created new class: "${trimmedClassName}"`)
                  } catch (e: any) {
                    pushJobError(job, `Row ${rowNum}: Failed to create class "${trimmedClassName}": ${e.message}`)
                    continue
                  }
                }
                
                // Assign student to class
                if (classId) {
                  try {
                    insertClassStudent.run(classId, id)
                  } catch (e: any) {
                    // Ignore duplicate entries
                    if (!e.message.includes('UNIQUE constraint failed')) {
                      pushJobError(job, `Row ${rowNum}: Failed to assign to class "${trimmedClassName}": ${e.message}`)
                    }
                  }
                }
              }
            }
          } catch (e: any) {
            errorCount++
            pushJobError(job, `Row ${rowNum}: ${e.message}`)
          }
        }
      })
      try { tx() } catch (e: any) {
        errorCount += batch.length
        pushJobError(job, `Batch ${batchIndex + 1} failed: ${e.message}`)
      }
      job.current = endIndex

      // Yield to event loop to keep server responsive
      await new Promise(r => setTimeout(r, 0))
    }

    job.status = 'completed'
    job.finishedAt = Date.now()
    job.result = { createdCount, errorCount, classesCreatedCount, createdUsers }
    pushJobMessage(job, `Import completed: ${createdCount} users created, ${classesCreatedCount} classes created, ${errorCount} errors`)
    pushJobMessage(job, `Download the CSV file with usernames and passwords from the completion screen.`)
  } catch (e: any) {
    job.status = 'failed'
    job.finishedAt = Date.now()
    job.error = e?.message || 'Import failed'
    pushJobMessage(job, `Import failed: ${job.error}`)
  }
}

// Admin creates users; teachers can create students
userRoutes.post('/', requireAuth, (req, res, next) => requireRole(['admin','teacher'])(req as any, res, next), async (req, res) => {
  const { username, email, password, role, firstName, lastName } = req.body as {
    username?: string; email?: string; password?: string; role: 'admin'|'teacher'|'student'; firstName?: string; lastName?: string;
  };
  if ((!username && !email) || !role) return res.status(400).json({ error: 'Missing fields' });
  const requester = (req as any).user as { role: 'admin'|'teacher' };
  if (requester.role === 'teacher' && role !== 'student') return res.status(403).json({ error: 'Teachers can only create students' });

  const id = nanoid();
  const tempPassword = password || generateTempPassword();
  const passwordHash = bcrypt.hashSync(tempPassword, 10);
  try {
    db.prepare('INSERT INTO users (id,username,email,password_hash,role,first_name,last_name,must_change_password) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, username ?? (email ? email.toLowerCase().split('@')[0] : null), email ? email.toLowerCase() : null, passwordHash, role, firstName ?? null, lastName ?? null, 1);
    
    // Always return the temp password so it can be displayed on screen
    res.json({ id, username, email, role, tempPassword });
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'User already exists' });
    return res.status(500).json({ error: 'Creation failed' });
  }
});

userRoutes.get('/', requireAuth, (req, res, next) => requireRole(['admin','teacher'])(req as any, res, next), (req, res) => {
  const requester = (req as any).user as { role: 'admin'|'teacher' };
  if (requester.role === 'admin') {
    const rows = db.prepare('SELECT id, username, email, role, first_name as firstName, last_name as lastName, created_at as createdAt, archived, archived_at as archivedAt FROM users WHERE archived = 0').all();
    return res.json(rows);
  }
  // Teachers: return only students (for class assignment and student creation context)
  const rows = db.prepare("SELECT id, username, email, role, first_name as firstName, last_name as lastName, created_at as createdAt, archived, archived_at as archivedAt FROM users WHERE role = 'student' AND archived = 0").all();
  return res.json(rows);
});

// CSV Template download - must be before /:id route
userRoutes.get('/csv-template', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), (req, res) => {
  try {
    const template = 'name,surname,username,email,archive_date,class1,class2,class3,class4,class5,class6,class7,class8,class9,class10\n"John","Doe","john.doe","john.doe@school.edu","","Math 101","Science 101","","","","","","","",""\n"Jane","Smith","jane.smith","jane.smith@school.edu","31/08/2025","Math 101","","English 101","","","","","","",""\n"Bob","Jones","bob.jones","bob.jones@school.edu","","Science 101","","","","","","","","",""';
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_template.csv"');
    res.send(template);
  } catch (error: any) {
    res.status(500).json({ error: 'Template generation failed: ' + error.message });
  }
});

// CSV Export - must be before /:id route
userRoutes.get('/export-csv', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), async (req, res) => {
  try {
    // Get all users with their class assignments
    const users = db.prepare(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.archived, u.archived_at,
        GROUP_CONCAT(c.name, '|') as classes
      FROM users u
      LEFT JOIN class_students cs ON u.id = cs.student_id
      LEFT JOIN classes c ON cs.class_id = c.id
      WHERE u.role = 'student'
      GROUP BY u.id
    `).all() as Array<{
      id: string;
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      archived: number;
      archived_at: string | null;
      classes: string | null;
    }>;

    // Convert to CSV format
    const csvData = users.map(user => {
      const classes = user.classes ? user.classes.split('|') : [];
      
      // Format archived_at to dd/mm/yyyy if present
      let archiveDateStr = '';
      if (user.archived && user.archived_at) {
        const date = new Date(user.archived_at);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        archiveDateStr = `${day}/${month}/${year}`;
      }
      
      const row: any = {
        name: user.first_name || '',
        surname: user.last_name || '',
        username: user.username || '',
        email: user.email || '',
        archive_date: archiveDateStr,
        class1: classes[0] || '',
        class2: classes[1] || '',
        class3: classes[2] || '',
        class4: classes[3] || '',
        class5: classes[4] || '',
        class6: classes[5] || '',
        class7: classes[6] || '',
        class8: classes[7] || '',
        class9: classes[8] || '',
        class10: classes[9] || ''
      };
      return row;
    });

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');

    // Create CSV content
    const headers = 'name,surname,username,email,archive_date,class1,class2,class3,class4,class5,class6,class7,class8,class9,class10\n';
    const csvContent = headers + csvData.map(row => 
      Object.values(row).map(val => `"${val || ''}"`).join(',')
    ).join('\n');

    res.send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed: ' + error.message });
  }
});

// Get archived users (admin only) - MUST come before /:id route
userRoutes.get('/archived', requireAuth, requireRole(['admin']), (req, res) => {
  const rows = db.prepare('SELECT id, username, email, role, first_name as firstName, last_name as lastName, created_at as createdAt, archived_at as archivedAt FROM users WHERE archived = 1 ORDER BY archived_at DESC').all();
  res.json(rows);
});

// Get specific user (admin only)
userRoutes.get('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id, username, email, role, first_name as firstName, last_name as lastName, created_at as createdAt FROM users WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

// Update user (admin only)
userRoutes.put('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { email, role, firstName, lastName } = req.body as { 
    email?: string; 
    role?: 'admin'|'teacher'|'student'; 
    firstName?: string; 
    lastName?: string; 
  };
  
  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  
  if (email !== undefined) {
    updates.push('email = ?');
    const normalizedEmail = (typeof email === 'string' && email.trim() !== '') ? email.toLowerCase() : null;
    values.push(normalizedEmail);
  }
  if (role !== undefined) {
    updates.push('role = ?');
    values.push(role);
  }
  if (firstName !== undefined) {
    updates.push('first_name = ?');
    values.push(firstName);
  }
  if (lastName !== undefined) {
    updates.push('last_name = ?');
    values.push(lastName);
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  values.push(id);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  
  try {
    db.prepare(query).run(...values);
    res.json({ id, message: 'User updated successfully' });
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Email already exists' });
    return res.status(500).json({ error: 'Update failed' });
  }
});

// Change user password (admin only)
userRoutes.put('/:id/password', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body as { newPassword: string };
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  
  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  // Hash the new password
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  
  try {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    res.json({ message: 'Password changed successfully' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Password change failed' });
  }
});

// Archive user (admin only)
userRoutes.post('/:id/archive', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if user exists and is not already archived
  const existing = db.prepare('SELECT id, role, archived FROM users WHERE id = ?').get(id) as { id: string; role: string; archived: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.archived) return res.status(400).json({ error: 'User is already archived' });
  
  // If trying to archive an admin, check if there are other active admins
  if (existing.role === 'admin') {
    const activeAdmins = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND archived = 0 AND id != ?').get('admin', id) as { count: number };
    if (activeAdmins.count === 0) {
      return res.status(400).json({ error: 'Cannot archive the last active admin user. At least one admin must remain active.' });
    }
  }
  
  // Archive user
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET archived = 1, archived_at = ? WHERE id = ?').run(now, id);
  res.json({ message: 'User archived successfully' });
});

// Restore user (admin only)
userRoutes.post('/:id/restore', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if user exists and is archived
  const existing = db.prepare('SELECT id, archived FROM users WHERE id = ?').get(id) as { id: string; archived: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (!existing.archived) return res.status(400).json({ error: 'User is not archived' });
  
  // Restore user
  db.prepare('UPDATE users SET archived = 0, archived_at = NULL WHERE id = ?').run(id);
  res.json({ message: 'User restored successfully' });
});

// Delete user (admin only)
userRoutes.delete('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  
  // Delete user (cascade will handle related records)
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'User deleted successfully' });
});

// CSV Import endpoint
userRoutes.post('/import-csv', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    // Set a longer timeout for large imports
    req.setTimeout(300000); // 5 minutes

    const csvData: any[] = [];
    const stream = Readable.from(req.file.buffer);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => csvData.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Starting CSV import of ${csvData.length} users...`);

    const results = {
      success: 0,
      errors: [] as string[],
      created: [] as any[],
      classesCreated: [] as string[]
    };

    // Get all existing classes for validation
    const classes = db.prepare('SELECT id, name FROM classes').all() as Array<{id: string, name: string}>;
    const classMap = new Map(classes.map(c => [c.name.toLowerCase(), c.id]));

    // Use database transaction for better performance and atomicity
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, must_change_password, archived, archived_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 1, ?, ?)
    `);
    
    const insertClass = db.prepare(`
      INSERT INTO classes (id, name, teacher_id, auto_archive_date, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    
    const insertClassStudent = db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)');

    // Process in batches to avoid memory issues
    const batchSize = 50;
    const totalBatches = Math.ceil(csvData.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, csvData.length);
      const batch = csvData.slice(startIndex, endIndex);

      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${startIndex + 1}-${endIndex})`);

      // Use transaction for each batch
      const transaction = db.transaction(() => {
        for (const [relativeIndex, row] of batch.entries()) {
          const index = startIndex + relativeIndex;
          try {
            const { name, surname, username, email, archive_date, class1, class2, class3, class4, class5, class6, class7, class8, class9, class10 } = row;
            
            if (!name || !surname || !username) {
              results.errors.push(`Row ${index + 1}: Missing required fields (name, surname, username)`);
              continue;
            }

            // Use email if provided, otherwise fall back to username
            const userEmail = email && email.trim() ? email.trim().toLowerCase() : username;

            // Check if user already exists (by username or email)
            const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, userEmail);
            if (existingUser) {
              results.errors.push(`Row ${index + 1}: User ${username} or email ${userEmail} already exists`);
              continue;
            }

            // Create user with random temporary password
            const id = nanoid();
            const tempPassword = generateTempPassword();
            const passwordHash = bcrypt.hashSync(tempPassword, 10);
            
            // Parse archive date if provided
            let archived = 0;
            let archivedAt = null;
            if (archive_date && archive_date.trim()) {
              const parsedDate = parseDDMMYYYY(archive_date);
              if (parsedDate) {
                archived = 1;
                archivedAt = parsedDate;
              } else {
                results.errors.push(`Row ${index + 1}: Invalid archive date format "${archive_date}" (expected dd/mm/yyyy)`);
              }
            }
            
            insertUser.run(id, username, userEmail, passwordHash, name, surname, archived, archivedAt);

            // Assign to classes
            const classColumns = [class1, class2, class3, class4, class5, class6, class7, class8, class9, class10];
            for (const className of classColumns) {
              if (className && className.trim()) {
                const trimmedClassName = className.trim();
                let classId = classMap.get(trimmedClassName.toLowerCase());
                
                // Create class if it doesn't exist
                if (!classId) {
                  try {
                    const newClassId = nanoid();
                    const oneYearFromNow = new Date();
                    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
                    const autoArchiveDate = oneYearFromNow.toISOString().split('T')[0]; // YYYY-MM-DD format
                    
                    // Get the first admin user as default teacher
                    const defaultTeacher = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') as { id: string } | undefined;
                    if (!defaultTeacher) {
                      results.errors.push(`Row ${index + 1}: No admin user found to assign as teacher for class "${trimmedClassName}"`);
                      continue;
                    }
                    
                    insertClass.run(newClassId, trimmedClassName, defaultTeacher.id, autoArchiveDate);
                    
                    classId = newClassId;
                    classMap.set(trimmedClassName.toLowerCase(), classId);
                    results.classesCreated.push(trimmedClassName);
                  } catch (e: any) {
                    results.errors.push(`Row ${index + 1}: Failed to create class "${trimmedClassName}": ${e.message}`);
                    continue;
                  }
                }
                
                // Assign student to class
                if (classId) {
                  try {
                    insertClassStudent.run(classId, id);
                  } catch (e: any) {
                    // Ignore duplicate entries
                    if (!e.message.includes('UNIQUE constraint failed')) {
                      console.error('Error assigning class:', e);
                    }
                  }
                }
              }
            }

            results.success++;
            results.created.push({ id, username, name, surname });
          } catch (error: any) {
            results.errors.push(`Row ${index + 1}: ${error.message}`);
          }
        }
      });

      // Execute the transaction for this batch
      try {
        transaction();
      } catch (error: any) {
        console.error(`Batch ${batchIndex + 1} failed:`, error);
        results.errors.push(`Batch ${batchIndex + 1} failed: ${error.message}`);
      }
    }

    console.log(`CSV import completed: ${results.success} users created, ${results.errors.length} errors`);
    
    let message = `Import completed. ${results.success} users created, ${results.errors.length} errors.`;
    if (results.classesCreated.length > 0) {
      message += ` ${results.classesCreated.length} classes created.`; // avoid huge messages
    }
    
    // Limit the number of created users returned to avoid large responses
    const limitedCreated = results.created.slice(0, 100);
    const limitedErrors = results.errors.slice(0, 50);
    
    res.json({
      message,
      results: {
        ...results,
        created: limitedCreated,
        errors: limitedErrors,
        totalCreated: results.created.length,
        totalErrors: results.errors.length
      }
    });
  } catch (error: any) {
    console.error('CSV import failed:', error);
    res.status(500).json({ error: 'CSV processing failed: ' + error.message });
  }
});


// Async CSV import: returns jobId immediately, progress via polling
userRoutes.post('/import-csv-async', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file provided' })

    // Save uploaded CSV to disk to avoid keeping it in memory across restarts
    const jobId = nanoid()
    const filePath = path.join(importsDir, `users-${jobId}.csv`)
    fs.writeFileSync(filePath, req.file.buffer)

    const job: ImportJob = {
      id: jobId,
      status: 'queued',
      total: 0,
      current: 0,
      messages: [],
      errors: [],
      startedAt: Date.now()
    }
    // attach filePath non-enumerable to job for internal use
    ;(job as any).filePath = filePath
    importJobs.set(jobId, job)

    pushJobMessage(job, 'File uploaded. Queued for processing...')
    // Kick off processing asynchronously
    setImmediate(() => startCsvProcessing(jobId))

    res.status(202).json({ jobId })
  } catch (error: any) {
    res.status(500).json({ error: 'CSV processing failed: ' + error.message })
  }
})

// Poll async import status
userRoutes.get('/import-status/:jobId', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), (req, res) => {
  const job = importJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    current: job.current,
    messages: job.messages,
    errors: job.errors,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    result: job.result,
    error: job.error
  })
})

// Cancel import job
userRoutes.post('/import-cancel/:jobId', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), (req, res) => {
  const job = importJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.status !== 'processing' && job.status !== 'queued') {
    return res.status(400).json({ error: 'Job cannot be cancelled' })
  }
  job.status = 'cancelled'
  pushJobMessage(job, 'Cancelling import...')
  res.json({ message: 'Import cancelled' })
})

// Download CSV with usernames and passwords for completed import
userRoutes.get('/import-download-csv/:jobId', requireAuth, (req, res, next) => requireRole(['admin'])(req as any, res, next), (req, res) => {
  const job = importJobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Job is not completed yet' })
  }
  if (!job.result?.createdUsers || job.result.createdUsers.length === 0) {
    return res.status(404).json({ error: 'No users were created in this import' })
  }
  
  // Generate CSV content
  const headers = 'username,password,name,surname\n'
  const csvContent = headers + job.result.createdUsers.map(user => 
    `"${user.username}","${user.password}","${user.name}","${user.surname}"`
  ).join('\n')
  
  // Set headers for CSV download
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="imported_users_${job.id}.csv"`)
  res.send(csvContent)
})
