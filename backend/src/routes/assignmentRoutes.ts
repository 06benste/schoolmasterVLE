import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const assignmentRoutes = Router();

// Assign lesson or assessment to classes/students
assignmentRoutes.post('/', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { title, type, refId, dueAt, targets, maxAttempts } = req.body as {
    title: string; type: 'lesson' | 'assessment'; refId: string; dueAt?: string; targets: Array<{ type: 'class'|'student'; id: string }>; maxAttempts?: number;
  };
  if (!title || !type || !refId || !targets?.length) return res.status(400).json({ error: 'Missing fields' });
  const id = nanoid();
  const assignedBy = (req as any).user.sub as string;
  db.prepare('INSERT INTO assignments (id,title,type,ref_id,assigned_by,due_at,max_attempts) VALUES (?,?,?,?,?,?,?)')
    .run(id, title, type, refId, assignedBy, dueAt ?? null, maxAttempts ?? null);
  const stmt = db.prepare('INSERT INTO assignment_targets (assignment_id,target_type,target_id) VALUES (?,?,?)');
  const insertMany = db.transaction((items: Array<{ type: string; id: string }>) => {
    for (const t of items) stmt.run(id, t.type, t.id);
  });
  insertMany(targets);
  res.json({ id });
});

// Update assignment
assignmentRoutes.put('/:assignmentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId } = req.params;
  const { title, dueAt, maxAttempts } = req.body as {
    title?: string; dueAt?: string; maxAttempts?: number;
  };
  
  // Check if assignment exists
  const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  
  // Update assignment
  const updateFields = [];
  const values = [];
  
  if (title !== undefined) {
    updateFields.push('title = ?');
    values.push(title);
  }
  if (dueAt !== undefined) {
    updateFields.push('due_at = ?');
    values.push(dueAt || null);
  }
  if (maxAttempts !== undefined) {
    updateFields.push('max_attempts = ?');
    values.push(maxAttempts || null);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(assignmentId);
  const query = `UPDATE assignments SET ${updateFields.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...values);
  
  res.json({ success: true });
});

// Record attempt (student submission)
assignmentRoutes.post('/:assignmentId/attempts', requireAuth, requireRole(['student']), (req, res) => {
  const { assignmentId } = req.params;
  const { score, maxScore, data } = req.body as { score?: number; maxScore?: number; data?: unknown };
  const studentId = (req as any).user.sub as string;
  
  
  // Check assignment exists and get max attempts
  const assignment = db.prepare('SELECT max_attempts FROM assignments WHERE id = ?').get(assignmentId) as { max_attempts: number | null } | undefined;
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  
  // Check current attempt count
  const attemptCount = db.prepare('SELECT COUNT(*) as count FROM attempts WHERE assignment_id = ? AND student_id = ?')
    .get(assignmentId, studentId) as { count: number };
  
  // Check if max attempts reached
  if (assignment.max_attempts && attemptCount.count >= assignment.max_attempts) {
    return res.status(400).json({ error: `Maximum attempts (${assignment.max_attempts}) reached for this assignment` });
  }
  
  const id = nanoid();
  db.prepare('INSERT INTO attempts (id,assignment_id,student_id,score,max_score,submitted_at,data_json) VALUES (?,?,?,?,?,datetime(\'now\'),?)')
    .run(id, assignmentId, studentId, score ?? null, maxScore ?? null, JSON.stringify(data ?? {}));
  res.json({ id, attemptNumber: attemptCount.count + 1, maxAttempts: assignment.max_attempts });
});

// Save progress without creating an attempt
assignmentRoutes.post('/:assignmentId/save-progress', requireAuth, requireRole(['student']), (req, res) => {
  const { assignmentId } = req.params;
  const { answers, savedAt } = req.body as { answers?: unknown; savedAt?: string };
  const studentId = (req as any).user.sub as string;
  
  
  // Check assignment exists
  const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  
  // Save progress data (this could be stored in a separate table or as a draft)
  // For now, we'll store it in a simple progress table
  try {
    // Check if progress already exists
    const existingProgress = db.prepare('SELECT id FROM assignment_progress WHERE assignment_id = ? AND student_id = ?')
      .get(assignmentId, studentId);
    
    
    const progressData = {
      answers: answers || {},
      savedAt: savedAt || new Date().toISOString()
    };
    
    if (existingProgress) {
      // Update existing progress
      db.prepare('UPDATE assignment_progress SET data_json = ?, updated_at = datetime(\'now\') WHERE assignment_id = ? AND student_id = ?')
        .run(JSON.stringify(progressData), assignmentId, studentId);
    } else {
      // Create new progress record
      const id = nanoid();
      db.prepare('INSERT INTO assignment_progress (id, assignment_id, student_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))')
        .run(id, assignmentId, studentId, JSON.stringify(progressData));
    }
    
    res.json({ message: 'Progress saved successfully' });
  } catch (err) {
    console.error('Error saving progress:', err);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// Track assignment access (when student opens an assignment)
assignmentRoutes.post('/:assignmentId/access', requireAuth, requireRole(['student']), (req, res) => {
  const { assignmentId } = req.params;
  const studentId = (req as any).user.sub as string;
  
  // Check if assignment exists
  const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  
  // Check if access already recorded
  const existingAccess = db.prepare('SELECT id FROM assignment_access WHERE assignment_id = ? AND student_id = ?')
    .get(assignmentId, studentId);
  
  if (!existingAccess) {
    // Record that student has accessed this assignment
    const id = nanoid();
    db.prepare('INSERT INTO assignment_access (id, assignment_id, student_id, accessed_at) VALUES (?, ?, ?, datetime(\'now\'))')
      .run(id, assignmentId, studentId);
  }
  
  res.json({ message: 'Access recorded' });
});

// Get saved progress for an assignment
assignmentRoutes.get('/:assignmentId/progress', requireAuth, requireRole(['student']), (req, res) => {
  const { assignmentId } = req.params;
  const studentId = (req as any).user.sub as string;
  
  
  try {
    const progress = db.prepare(`
      SELECT data_json, updated_at 
      FROM assignment_progress 
      WHERE assignment_id = ? AND student_id = ?
    `).get(assignmentId, studentId) as { data_json: string; updated_at: string } | undefined;
    
    
    if (progress) {
      const parsedData = progress.data_json ? JSON.parse(progress.data_json) : {};
      res.json({
        data: parsedData.answers || {},
        lastSaved: progress.updated_at
      });
    } else {
      res.json({ data: {}, lastSaved: null });
    }
  } catch (err) {
    console.error('Error retrieving progress:', err);
    res.status(500).json({ error: 'Failed to retrieve progress' });
  }
});

// List assignments for a user (student)
assignmentRoutes.get('/my', requireAuth, requireRole(['student']), (req, res) => {
  const studentId = (req as any).user.sub as string;
  
  // Get assignments with completion status
  const rows = db.prepare(`
    SELECT 
      a.*, 
      l.title as lesson_title, 
      l.description as lesson_description,
      ass.title as assessment_title,
      ass.description as assessment_description,
      CASE 
        WHEN EXISTS(SELECT 1 FROM attempts WHERE assignment_id = a.id AND student_id = ?) THEN 'completed'
        WHEN EXISTS(SELECT 1 FROM assignment_access WHERE assignment_id = a.id AND student_id = ?) THEN 'in_progress'
        ELSE 'unattempted'
      END as status,
      CASE 
        WHEN EXISTS(SELECT 1 FROM attempts WHERE assignment_id = a.id AND student_id = ?) THEN 1
        ELSE 0
      END as isCompleted
    FROM assignments a
    JOIN assignment_targets t ON t.assignment_id = a.id
    LEFT JOIN lessons l ON a.ref_id = l.id AND a.type = 'lesson'
    LEFT JOIN assessments ass ON a.ref_id = ass.id AND a.type = 'assessment'
    WHERE (t.target_type='student' AND t.target_id = ?) OR (t.target_type='class' AND t.target_id IN (
      SELECT class_id FROM class_students WHERE student_id = ?
    ))
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all(studentId, studentId, studentId, studentId, studentId);
  
  res.json(rows);
});

// List all assignments with completion status (admin/teacher)
assignmentRoutes.get('/', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const rows = db.prepare(`
    SELECT 
      a.id, a.title, a.type, a.due_at, a.created_at, a.max_attempts,
      l.title as lesson_title,
      ass.title as assessment_title,
      u.first_name || ' ' || u.last_name as assigned_by_name,
      COUNT(DISTINCT at.target_id) as total_targets,
      COUNT(DISTINCT att.student_id) as students_attempted,
      COUNT(att.id) as total_attempts
    FROM assignments a
    LEFT JOIN lessons l ON a.ref_id = l.id AND a.type = 'lesson'
    LEFT JOIN assessments ass ON a.ref_id = ass.id AND a.type = 'assessment'
    LEFT JOIN users u ON a.assigned_by = u.id
    LEFT JOIN assignment_targets at ON a.id = at.assignment_id
    LEFT JOIN attempts att ON a.id = att.assignment_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();
  res.json(rows);
});

// Get assignment details with student completion status
assignmentRoutes.get('/:id/completion', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  
  // Get assignment details
  const assignment = db.prepare(`
    SELECT 
      a.*, 
      l.title as lesson_title, l.description as lesson_description,
      ass.title as assessment_title, ass.description as assessment_description,
      u.first_name || ' ' || u.last_name as assigned_by_name
    FROM assignments a
    LEFT JOIN lessons l ON a.ref_id = l.id AND a.type = 'lesson'
    LEFT JOIN assessments ass ON a.ref_id = ass.id AND a.type = 'assessment'
    LEFT JOIN users u ON a.assigned_by = u.id
    WHERE a.id = ?
  `).get(id) as any;
  
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  
  // Get all targeted students
  const students = db.prepare(`
    SELECT DISTINCT 
      s.id, s.first_name, s.last_name, s.email,
      CASE 
        WHEN at.target_type = 'student' THEN NULL
        WHEN at.target_type = 'class' THEN at.target_id
      END as class_id,
      CASE 
        WHEN at.target_type = 'student' THEN NULL
        WHEN at.target_type = 'class' THEN c.name
      END as class_name
    FROM assignment_targets at
    LEFT JOIN users s ON (
      (at.target_type = 'student' AND at.target_id = s.id) OR
      (at.target_type = 'class' AND at.target_id IN (
        SELECT class_id FROM class_students WHERE student_id = s.id
      ))
    )
    LEFT JOIN classes c ON (at.target_type = 'class' AND at.target_id = c.id)
    WHERE at.assignment_id = ? AND s.role = 'student'
  `).all(id) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    class_id: string | null;
    class_name: string | null;
  }>;
  
  // Get attempt data for each student
  const attempts = db.prepare(`
    SELECT 
      att.student_id, att.score, att.max_score, att.submitted_at,
      ROW_NUMBER() OVER (PARTITION BY att.student_id ORDER BY att.id) as attempt_number
    FROM attempts att
    WHERE att.assignment_id = ?
    ORDER BY att.student_id, att.id
  `).all(id) as Array<{
    student_id: string;
    score: number | null;
    max_score: number | null;
    submitted_at: string;
    attempt_number: number;
  }>;

  // Get access data for each student
  const accessData = db.prepare(`
    SELECT student_id, accessed_at
    FROM assignment_access
    WHERE assignment_id = ?
  `).all(id) as Array<{
    student_id: string;
    accessed_at: string;
  }>;
  
  // Combine data
  const completionData = students.map(student => {
    const studentAttempts = attempts.filter(attempt => attempt.student_id === student.id);
    const latestAttempt = studentAttempts[studentAttempts.length - 1];
    const studentAccess = accessData.find(access => access.student_id === student.id);
    
    // Determine status based on attempts and access
    let status = 'unattempted';
    if (studentAttempts.length > 0) {
      status = 'completed';
    } else if (studentAccess) {
      status = 'in_progress';
    }
    
    return {
      ...student,
      attempts: studentAttempts,
      attemptCount: studentAttempts.length,
      latestScore: latestAttempt?.score,
      maxScore: latestAttempt?.max_score,
      lastSubmitted: latestAttempt?.submitted_at,
      lastAccessed: studentAccess?.accessed_at,
      isCompleted: studentAttempts.length > 0,
      status: status,
      canAttempt: !assignment.max_attempts || studentAttempts.length < assignment.max_attempts
    };
  });
  
  res.json({
    assignment,
    students: completionData,
    summary: {
      totalStudents: students.length,
      completed: completionData.filter(s => s.isCompleted).length,
      inProgress: completionData.filter(s => !s.isCompleted && s.canAttempt).length,
      maxAttemptsReached: completionData.filter(s => !s.canAttempt && !s.isCompleted).length
    }
  });
});

// Delete assignment (admin/teacher only)
assignmentRoutes.delete('/:id', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  
  // Check if assignment exists
  const existing = db.prepare('SELECT id FROM assignments WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Assignment not found' });
  
  // Delete assignment (cascade will handle related records like attempts and targets)
  db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  res.json({ message: 'Assignment deleted successfully' });
});

// Get individual assignment details
assignmentRoutes.get('/:id', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { id } = req.params;
  
  const assignment = db.prepare(`
    SELECT 
      a.id, a.title, a.type, a.ref_id, a.due_at, a.created_at, a.max_attempts,
      u.first_name as assigned_by_name, u.last_name as assigned_by_lastname
    FROM assignments a
    LEFT JOIN users u ON a.assigned_by = u.id
    WHERE a.id = ?
  `).get(id) as any;
  
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  
  res.json(assignment);
});

// Get student attempts for an assignment
assignmentRoutes.get('/:assignmentId/attempts/:studentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId, studentId } = req.params;
  
  const attempts = db.prepare(`
    SELECT 
      id, score, max_score, submitted_at, data_json,
      ROW_NUMBER() OVER (ORDER BY submitted_at) as attempt_number
    FROM attempts 
    WHERE assignment_id = ? AND student_id = ?
    ORDER BY submitted_at
  `).all(assignmentId, studentId) as any[];
  
  // Parse the data_json for each attempt
  const parsedAttempts = attempts.map(attempt => ({
    ...attempt,
    responses: attempt.data_json ? JSON.parse(attempt.data_json) : {}
  }));
  
  res.json(parsedAttempts);
});

// Update score for a specific question in an attempt
assignmentRoutes.put('/:assignmentId/attempts/:attemptId/score', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId, attemptId } = req.params;
  const { questionIndex, score } = req.body;
  
  // Get the current attempt data
  const attempt = db.prepare('SELECT data_json FROM attempts WHERE id = ? AND assignment_id = ?').get(attemptId, assignmentId) as { data_json: string } | undefined;
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  
  const data = attempt.data_json ? JSON.parse(attempt.data_json) : {};
  
  // Update the question score
  if (!data.questionScores) data.questionScores = {};
  data.questionScores[questionIndex] = score;
  
  // Calculate new overall score as total marks earned
  const questionScores = Object.values(data.questionScores) as number[];
  const newScore = questionScores.length > 0 ? questionScores.reduce((a, b) => a + b, 0) : 0;
  
  console.log('Score update debug:', {
    questionScores,
    newScore,
    questionIndex,
    score
  });
  
  // Update the attempt
  db.prepare('UPDATE attempts SET score = ?, data_json = ? WHERE id = ?')
    .run(newScore, JSON.stringify(data), attemptId);
  
  res.json({ message: 'Score updated successfully', newScore });
});

// Reset student attempts for an assignment (admin/teacher only)
assignmentRoutes.delete('/:assignmentId/attempts/:studentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId, studentId } = req.params;
  
  
  try {
    // Check if assignment exists
    const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Check if student exists
    const student = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Delete all attempts for this student and assignment
    const result = db.prepare('DELETE FROM attempts WHERE assignment_id = ? AND student_id = ?')
      .run(assignmentId, studentId);
    
    
    res.json({ 
      message: 'Student attempts reset successfully', 
      deletedAttempts: result.changes 
    });
  } catch (err) {
    console.error('Error resetting attempts:', err);
    res.status(500).json({ error: 'Failed to reset student attempts' });
  }
});