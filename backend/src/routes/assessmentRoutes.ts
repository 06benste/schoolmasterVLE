import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const assessmentRoutes = Router();

// Admin create assessment (self-marked similar structure to lessons)
assessmentRoutes.post('/', requireAuth, requireRole(['admin']), (req, res) => {
  console.log('Assessment creation request:', {
    body: req.body,
    user: (req as any).user
  });
  
  const { title, description, content } = req.body as { title: string; description?: string; content: unknown };
  
  console.log('Parsed fields:', { title, description, content: typeof content });
  
  if (!title || title.trim() === '') {
    console.log('Validation failed: title is empty or missing');
    return res.status(400).json({ error: 'Assessment title is required' });
  }
  
  if (!content) {
    console.log('Validation failed: content is missing');
    return res.status(400).json({ error: 'Assessment content is required' });
  }
  
  // Check if content has blocks
  if (typeof content === 'object' && content !== null && 'blocks' in content) {
    const blocks = (content as any).blocks;
    if (!Array.isArray(blocks) || blocks.length === 0) {
      console.log('Validation failed: content.blocks is empty or not an array');
      return res.status(400).json({ error: 'Assessment content must have at least one block' });
    }
  }
  
  try {
    const id = nanoid();
    const creatorId = (req as any).user.sub as string;
    console.log('Creating assessment:', { id, title, creatorId });
    
    db.prepare('INSERT INTO assessments (id,title,description,content_json,created_by) VALUES (?,?,?,?,?)')
      .run(id, title, description ?? null, JSON.stringify(content), creatorId);
    
    console.log('Assessment created successfully');
    res.json({ id, title });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error: ' + (error as Error).message });
  }
});

assessmentRoutes.get('/', requireAuth, requireRole(['admin','teacher']), (_req, res) => {
  const rows = db.prepare('SELECT id, title, description, created_at as createdAt FROM assessments ORDER BY created_at DESC').all();
  res.json(rows);
});

assessmentRoutes.get('/:id', requireAuth, (req, res) => {
  const assessmentId = req.params.id;
  const userId = (req as any).user.sub as string;
  const userRole = (req as any).user.role as string;
  
  // Admin and teachers can access any assessment
  if (userRole === 'admin' || userRole === 'teacher') {
    const row = db
      .prepare('SELECT id,title,description,content_json as contentJson FROM assessments WHERE id = ?')
      .get(assessmentId) as | { id: string; title: string; description?: string | null; contentJson: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ id: row.id, title: row.title, description: row.description ?? undefined, content: JSON.parse(row.contentJson) });
    return;
  }
  
  // Students can only access assessments that are assigned to them
  if (userRole === 'student') {
    const assignment = db.prepare(`
      SELECT a.id FROM assignments a
      JOIN assignment_targets t ON t.assignment_id = a.id
      WHERE a.ref_id = ? AND a.type = 'assessment' 
      AND ((t.target_type = 'student' AND t.target_id = ?) 
           OR (t.target_type = 'class' AND t.target_id IN (
             SELECT class_id FROM class_students WHERE student_id = ?
           )))
    `).get(assessmentId, userId, userId);
    
    if (!assignment) {
      return res.status(403).json({ error: 'Access denied. This assessment is not assigned to you.' });
    }
  }
  
  const row = db
    .prepare('SELECT id,title,description,content_json as contentJson FROM assessments WHERE id = ?')
    .get(assessmentId) as | { id: string; title: string; description?: string | null; contentJson: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ id: row.id, title: row.title, description: row.description ?? undefined, content: JSON.parse(row.contentJson) });
});

// Update assessment (admin only)
assessmentRoutes.put('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { title, description, content } = req.body as { title: string; description?: string; content: unknown };
  
  // Check if assessment exists
  const existing = db.prepare('SELECT id FROM assessments WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Assessment not found' });
  
  try {
    db.prepare('UPDATE assessments SET title = ?, description = ?, content_json = ? WHERE id = ?')
      .run(title, description ?? null, JSON.stringify(content), id);
    res.json({ id, message: 'Assessment updated successfully' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Update failed' });
  }
});

// Delete assessment (admin only)
assessmentRoutes.delete('/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  // Check if assessment exists
  const existing = db.prepare('SELECT id FROM assessments WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Assessment not found' });
  
  // Delete assessment (cascade will handle related records)
  db.prepare('DELETE FROM assessments WHERE id = ?').run(id);
  res.json({ message: 'Assessment deleted successfully' });
});


