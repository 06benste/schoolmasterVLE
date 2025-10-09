import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const classRoutes = Router();

// Create class (admin or teacher)
classRoutes.post('/', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { name, teacherId, autoArchiveDate } = req.body as { name: string; teacherId?: string; autoArchiveDate?: string };
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  const resolvedTeacherId = requester.role === 'teacher' ? requester.sub : (teacherId ?? requester.sub);
  const id = nanoid();
  db.prepare('INSERT INTO classes (id, name, teacher_id, auto_archive_date) VALUES (?,?,?,?)').run(id, name, resolvedTeacherId, autoArchiveDate || null);
  res.json({ id, name, teacherId: resolvedTeacherId, autoArchiveDate });
});

// List classes (admin/teacher)
classRoutes.get('/', requireAuth, requireRole(['admin','teacher']), (_req, res) => {
  try {
    console.log('Fetching classes...');
    
    // First try with archived columns
    try {
      const rows = db.prepare('SELECT id, name, teacher_id as teacherId, auto_archive_date as autoArchiveDate, created_at as createdAt, archived, archived_at as archivedAt FROM classes WHERE archived = 0 ORDER BY created_at DESC').all();
      console.log('Classes fetched successfully:', rows.length, 'classes');
      res.json(rows);
      return;
    } catch (archivedError) {
      console.log('Archived columns not found, trying without archived filter...');
      
      // Fallback: try without archived columns
      const rows = db.prepare('SELECT id, name, teacher_id as teacherId, auto_archive_date as autoArchiveDate, created_at as createdAt FROM classes ORDER BY created_at DESC').all();
      console.log('Classes fetched successfully (fallback):', rows.length, 'classes');
      res.json(rows);
    }
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes: ' + (error as Error).message });
  }
});

// List classes (simple)
classRoutes.get('/placeholder-list', requireAuth, requireRole(['admin','teacher','student']), (_req, res) => {
  const rows = db.prepare('SELECT id, name, teacher_id as teacherId, auto_archive_date as autoArchiveDate FROM classes WHERE archived = 0 ORDER BY created_at DESC').all();
  res.json(rows);
});

// Get archived classes (admin only) - MUST come before /:id route
classRoutes.get('/archived', requireAuth, requireRole(['admin']), (req, res) => {
  const rows = db.prepare('SELECT id, name, teacher_id as teacherId, created_at as createdAt, archived_at as archivedAt FROM classes WHERE archived = 1 ORDER BY archived_at DESC').all();
  res.json(rows);
});

// Auto-archive classes that have reached their auto-archive date (admin only)
classRoutes.post('/auto-archive', requireAuth, requireRole(['admin']), (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Find classes that should be auto-archived today
  const classesToArchive = db.prepare(`
    SELECT id, name FROM classes 
    WHERE archived = 0 
    AND auto_archive_date = ? 
    AND auto_archive_date IS NOT NULL
  `).all(today) as Array<{ id: string; name: string }>;
  
  let archivedCount = 0;
  const now = new Date().toISOString();
  
  for (const classToArchive of classesToArchive) {
    // Archive the class
    db.prepare('UPDATE classes SET archived = 1, archived_at = ? WHERE id = ?').run(now, classToArchive.id);
    
    // Archive all students in this class
    const students = db.prepare('SELECT student_id FROM class_students WHERE class_id = ?').all(classToArchive.id) as Array<{ student_id: string }>;
    for (const student of students) {
      db.prepare('UPDATE users SET archived = 1, archived_at = ? WHERE id = ? AND role = ?').run(now, student.student_id, 'student');
    }
    
    archivedCount++;
  }
  
  res.json({ 
    message: `Auto-archived ${archivedCount} classes and their students`,
    archivedClasses: classesToArchive.map(c => c.name)
  });
});

// Get specific class
classRoutes.get('/:id', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id, name, teacher_id as teacherId, created_at as createdAt FROM classes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Class not found' });
  res.json(row);
});

// Update class (admin or teacher who owns the class)
classRoutes.put('/:id', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  const { name, teacherId, autoArchiveDate } = req.body as { name?: string; teacherId?: string; autoArchiveDate?: string };
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  
  // Check if class exists
  const existing = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(id) as { id: string; teacher_id: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'Class not found' });
  
  // Teachers can only update their own classes
  if (requester.role === 'teacher' && existing.teacher_id !== requester.sub) {
    return res.status(403).json({ error: 'You can only update your own classes' });
  }
  
  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (teacherId !== undefined && requester.role === 'admin') {
    updates.push('teacher_id = ?');
    values.push(teacherId);
  }
  if (autoArchiveDate !== undefined) {
    updates.push('auto_archive_date = ?');
    values.push(autoArchiveDate || null);
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  values.push(id);
  const query = `UPDATE classes SET ${updates.join(', ')} WHERE id = ?`;
  
  db.prepare(query).run(...values);
  res.json({ id, message: 'Class updated successfully' });
});

// Archive class (admin or teacher who owns the class)
classRoutes.post('/:id/archive', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  
  // Check if class exists and is not already archived
  const existing = db.prepare('SELECT id, teacher_id, archived FROM classes WHERE id = ?').get(id) as { id: string; teacher_id: string; archived: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'Class not found' });
  if (existing.archived) return res.status(400).json({ error: 'Class is already archived' });
  
  // Teachers can only archive their own classes
  if (requester.role === 'teacher' && existing.teacher_id !== requester.sub) {
    return res.status(403).json({ error: 'You can only archive your own classes' });
  }
  
  // Archive class and all its students
  const now = new Date().toISOString();
  db.prepare('UPDATE classes SET archived = 1, archived_at = ? WHERE id = ?').run(now, id);
  
  // Archive all students in this class
  const students = db.prepare('SELECT student_id FROM class_students WHERE class_id = ?').all(id) as Array<{ student_id: string }>;
  for (const student of students) {
    db.prepare('UPDATE users SET archived = 1, archived_at = ? WHERE id = ? AND role = ?').run(now, student.student_id, 'student');
  }
  
  res.json({ message: 'Class and all students archived successfully' });
});

// Restore class (admin or teacher who owns the class)
classRoutes.post('/:id/restore', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  const { restoreStudents } = req.body as { restoreStudents?: boolean };
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  
  // Check if class exists and is archived
  const existing = db.prepare('SELECT id, teacher_id, archived FROM classes WHERE id = ?').get(id) as { id: string; teacher_id: string; archived: number } | undefined;
  if (!existing) return res.status(404).json({ error: 'Class not found' });
  if (!existing.archived) return res.status(400).json({ error: 'Class is not archived' });
  
  // Teachers can only restore their own classes
  if (requester.role === 'teacher' && existing.teacher_id !== requester.sub) {
    return res.status(403).json({ error: 'You can only restore your own classes' });
  }
  
  // Restore class
  db.prepare('UPDATE classes SET archived = 0, archived_at = NULL WHERE id = ?').run(id);
  
  let message = 'Class restored successfully';
  
  // Optionally restore all students in this class
  if (restoreStudents) {
    const students = db.prepare('SELECT student_id FROM class_students WHERE class_id = ?').all(id) as Array<{ student_id: string }>;
    for (const student of students) {
      db.prepare('UPDATE users SET archived = 0, archived_at = NULL WHERE id = ? AND role = ?').run(student.student_id, 'student');
    }
    message += ` and ${students.length} students restored`;
  }
  
  res.json({ message });
});

// Delete class (admin or teacher who owns the class)
classRoutes.delete('/:id', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  
  // Check if class exists
  const existing = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(id) as { id: string; teacher_id: string } | undefined;
  if (!existing) return res.status(404).json({ error: 'Class not found' });
  
  // Teachers can only delete their own classes
  if (requester.role === 'teacher' && existing.teacher_id !== requester.sub) {
    return res.status(403).json({ error: 'You can only delete your own classes' });
  }
  
  // Delete class (cascade will handle related records)
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  res.json({ message: 'Class deleted successfully' });
});

// Add student to class
classRoutes.post('/:classId/students', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { classId } = req.params;
  const { studentId } = req.body as { studentId: string };
  if (!studentId) return res.status(400).json({ error: 'Missing studentId' });
  db.prepare('INSERT OR IGNORE INTO class_students (class_id, student_id) VALUES (?,?)').run(classId, studentId);
  res.json({ ok: true });
});

// Remove student from class
classRoutes.delete('/:classId/students/:studentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { classId, studentId } = req.params;
  const requester = (req as any).user as { sub: string; role: 'admin'|'teacher' };
  
  // Check if class exists and get teacher
  const classData = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(classId) as { teacher_id: string } | undefined;
  if (!classData) return res.status(404).json({ error: 'Class not found' });
  
  // Teachers can only remove students from their own classes
  if (requester.role === 'teacher' && classData.teacher_id !== requester.sub) {
    return res.status(403).json({ error: 'You can only manage students in your own classes' });
  }
  
  db.prepare('DELETE FROM class_students WHERE class_id = ? AND student_id = ?').run(classId, studentId);
  res.json({ ok: true });
});

// List students in a class
classRoutes.get('/:classId/students', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { classId } = req.params;
  const rows = db.prepare(`
    SELECT u.id, u.first_name as firstName, u.last_name as lastName, u.email
    FROM class_students cs JOIN users u ON cs.student_id = u.id
    WHERE cs.class_id = ?
  `).all(classId);
  res.json(rows);
});

// Marksheet for a class: students and their latest attempt per assignment
classRoutes.get('/:classId/marksheet', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { classId } = req.params;
  const students = db.prepare(`
    SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.email
    FROM class_students cs JOIN users u ON cs.student_id = u.id
    WHERE cs.class_id = ?
  `).all(classId);

  const assignments = db.prepare(`
    SELECT a.id, a.title, a.type FROM assignments a
    WHERE a.id IN (
      SELECT assignment_id FROM assignment_targets t
      WHERE (t.target_type='class' AND t.target_id = @classId)
         OR (t.target_type='student' AND t.target_id IN (
              SELECT student_id FROM class_students WHERE class_id = @classId
            ))
    )
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all({ classId });

  const scores = db.prepare(`
    SELECT a.student_id as studentId, a.assignment_id as assignmentId, a.score, a.max_score as maxScore, a.submitted_at as submittedAt
    FROM attempts a
    JOIN (
      SELECT student_id, assignment_id, MAX(id) AS latest_id
      FROM attempts
      GROUP BY student_id, assignment_id
    ) latest
    ON latest.student_id = a.student_id AND latest.assignment_id = a.assignment_id AND latest.latest_id = a.id
    WHERE a.assignment_id IN (SELECT id FROM assignments)
  `).all();

  res.json({ students, assignments, scores });
});


