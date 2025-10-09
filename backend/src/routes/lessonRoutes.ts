import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const lessonRoutes = Router();

// Admin can create lessons (guided lessons)
lessonRoutes.post('/', requireAuth, requireRole(['admin']), (req, res) => {
  console.log('Lesson creation request:', {
    body: req.body,
    user: (req as any).user
  });
  
  const { title, description, content } = req.body as { title: string; description?: string; content: unknown };
  
  console.log('Parsed lesson fields:', { title, description, content: typeof content });
  
  if (!title || title.trim() === '') {
    console.log('Validation failed: title is empty or missing');
    return res.status(400).json({ error: 'Lesson title is required' });
  }
  
  if (!content) {
    console.log('Validation failed: content is missing');
    return res.status(400).json({ error: 'Lesson content is required' });
  }
  
  try {
    const id = nanoid();
    const creatorId = (req as any).user.sub as string;
    console.log('Creating lesson:', { id, title, creatorId });
    
    db.prepare('INSERT INTO lessons (id,title,description,content_json,created_by) VALUES (?,?,?,?,?)')
      .run(id, title, description ?? null, JSON.stringify(content), creatorId);
    
    console.log('Lesson created successfully');
    res.json({ id, title });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error: ' + (error as Error).message });
  }
});

lessonRoutes.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT 
      l.id, 
      l.title, 
      l.description, 
      l.created_at as createdAt,
      t.id as topicId,
      t.title as topicTitle,
      c.id as courseId,
      c.title as courseTitle
    FROM lessons l
    LEFT JOIN topic_lessons tl ON l.id = tl.lesson_id
    LEFT JOIN topics t ON tl.topic_id = t.id
    LEFT JOIN courses c ON t.course_id = c.id
    ORDER BY l.created_at DESC
  `).all();
  res.json(rows);
});

lessonRoutes.get('/:id', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id,title,description,content_json as contentJson FROM lessons WHERE id = ?')
    .get(req.params.id) as | { id: string; title: string; description?: string | null; contentJson: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  const response = {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    content: JSON.parse(row.contentJson)
  };
  res.json(response);
});

// Update lesson (admin only)
lessonRoutes.put('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { title, description, content } = req.body as { title?: string; description?: string; content?: unknown };
  
  // Check if lesson exists
  const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Lesson not found' });
  
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
  if (content !== undefined) {
    updates.push('content_json = ?');
    values.push(JSON.stringify(content));
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  
  values.push(id);
  const query = `UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`;
  
  db.prepare(query).run(...values);
  res.json({ id, message: 'Lesson updated successfully' });
});

// Delete lesson (admin only)
lessonRoutes.delete('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if lesson exists
  const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Lesson not found' });
  
  // Delete lesson (cascade will handle related records)
  db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
  res.json({ message: 'Lesson deleted successfully' });
});



