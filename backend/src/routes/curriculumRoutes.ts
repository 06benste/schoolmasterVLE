import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const curriculumRoutes = Router();

// Courses
curriculumRoutes.post('/courses', requireAuth, requireRole(['admin']), (req, res) => {
  const { title, description } = req.body as { title: string; description?: string };
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const id = nanoid();
  db.prepare('INSERT INTO courses (id,title,description) VALUES (?,?,?)').run(id, title, description ?? null);
  res.json({ id });
});

curriculumRoutes.get('/courses', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, title, description FROM courses ORDER BY created_at DESC').all();
  res.json(rows);
});

// Get specific course
curriculumRoutes.get('/courses/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id, title, description, created_at as createdAt FROM courses WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Course not found' });
  res.json(row);
});

// Update course (admin only)
curriculumRoutes.put('/courses/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body as { title?: string; description?: string };
  
  // Check if course exists
  const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Course not found' });
  
  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  values.push(id);
  const query = `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`;
  
  db.prepare(query).run(...values);
  res.json({ id, message: 'Course updated successfully' });
});

// Delete course (admin only)
curriculumRoutes.delete('/courses/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if course exists
  const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Course not found' });
  
  // Delete course (cascade will handle related records)
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  res.json({ message: 'Course deleted successfully' });
});

// Topics
curriculumRoutes.post('/courses/:courseId/topics', requireAuth, requireRole(['admin']), (req, res) => {
  const { courseId } = req.params;
  const { title, description, position } = req.body as { title: string; description?: string; position?: number };
  if (!title) return res.status(400).json({ error: 'Missing title' });
  const id = nanoid();
  db.prepare('INSERT INTO topics (id,course_id,title,description,position) VALUES (?,?,?,?,?)')
    .run(id, courseId, title, description ?? null, position ?? 0);
  res.json({ id });
});

curriculumRoutes.get('/courses/:courseId/topics', requireAuth, (req, res) => {
  const { courseId } = req.params;
  const rows = db.prepare('SELECT id, title, description, position FROM topics WHERE course_id = ? ORDER BY position ASC, title ASC').all(courseId);
  res.json(rows);
});

// Get all topics with course information
curriculumRoutes.get('/topics', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.title, t.description, t.position, t.course_id, c.title as course_title
    FROM topics t 
    JOIN courses c ON t.course_id = c.id 
    ORDER BY c.title ASC, t.position ASC, t.title ASC
  `).all();
  res.json(rows);
});

// Get specific topic
curriculumRoutes.get('/topics/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id, course_id as courseId, title, description, position FROM topics WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Topic not found' });
  res.json(row);
});

// Update topic (admin only)
curriculumRoutes.put('/topics/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { title, description, position } = req.body as { title?: string; description?: string; position?: number };
  
  // Check if topic exists
  const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Topic not found' });
  
  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (position !== undefined) {
    updates.push('position = ?');
    values.push(position);
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  values.push(id);
  const query = `UPDATE topics SET ${updates.join(', ')} WHERE id = ?`;
  
  db.prepare(query).run(...values);
  res.json({ id, message: 'Topic updated successfully' });
});

// Delete topic (admin only)
curriculumRoutes.delete('/topics/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if topic exists
  const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Topic not found' });
  
  // Delete topic (cascade will handle related records)
  db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  res.json({ message: 'Topic deleted successfully' });
});

// Assign lessons to topics
curriculumRoutes.post('/topics/:topicId/lessons', requireAuth, requireRole(['admin']), (req, res) => {
  const { topicId } = req.params;
  const { lessonId, position } = req.body as { lessonId: string; position?: number };
  if (!lessonId) return res.status(400).json({ error: 'Missing lessonId' });
  db.prepare('INSERT OR REPLACE INTO topic_lessons (topic_id,lesson_id,position) VALUES (?,?,?)')
    .run(topicId, lessonId, position ?? 0);
  res.json({ ok: true });
});

curriculumRoutes.get('/topics/:topicId/lessons', requireAuth, (req, res) => {
  const { topicId } = req.params;
  const rows = db.prepare(`
    SELECT l.id, l.title, l.description, tl.position
    FROM topic_lessons tl JOIN lessons l ON tl.lesson_id = l.id
    WHERE tl.topic_id = ?
    ORDER BY tl.position ASC
  `).all(topicId);
  res.json(rows);
});

// Remove lesson from topic
curriculumRoutes.delete('/topics/:topicId/lessons/:lessonId', requireAuth, requireRole(['admin']), (req, res) => {
  const { topicId, lessonId } = req.params;
  
  // Check if topic exists
  const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(topicId);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  
  // Check if lesson exists
  const lesson = db.prepare('SELECT id FROM lessons WHERE id = ?').get(lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  
  // Remove lesson from topic
  db.prepare('DELETE FROM topic_lessons WHERE topic_id = ? AND lesson_id = ?').run(topicId, lessonId);
  res.json({ message: 'Lesson removed from topic successfully' });
});


