import { Router } from 'express';
import { db } from '../db.js';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../auth.js';

export const courseAssignmentRoutes = Router();

// Assign course to students/classes
courseAssignmentRoutes.post('/courses/assign', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { courseId, targets } = req.body as { courseId: string; targets: Array<{ type: 'student' | 'class'; id: string }> };
  const assignedBy = (req as any).user.sub as string;

  try {
    // Check if course exists
    const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check for existing assignments to prevent duplicates
    const existingAssignments = db.prepare(`
      SELECT target_type, target_id FROM course_assignments 
      WHERE course_id = ? AND target_type = ? AND target_id = ?
    `);

    const duplicates: Array<{ type: string; id: string; name: string }> = [];
    const validTargets: Array<{ type: string; id: string }> = [];

    for (const target of targets) {
      const existing = existingAssignments.get(courseId, target.type, target.id);
      if (existing) {
        // Get the name of the duplicate target for better error message
        let targetName = '';
        if (target.type === 'class') {
          const classInfo = db.prepare('SELECT name FROM classes WHERE id = ?').get(target.id) as { name: string } | undefined;
          targetName = classInfo?.name || target.id;
        } else {
          const userInfo = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(target.id) as { first_name: string; last_name: string } | undefined;
          targetName = userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : target.id;
        }
        duplicates.push({ type: target.type, id: target.id, name: targetName });
      } else {
        validTargets.push(target);
      }
    }

    // If there are duplicates, return error with details
    if (duplicates.length > 0) {
      const duplicateMessages = duplicates.map(d => 
        `${d.name} (${d.type})`
      ).join(', ');
      return res.status(409).json({ 
        error: `Course is already assigned to: ${duplicateMessages}`,
        duplicates: duplicates.map(d => ({ type: d.type, id: d.id, name: d.name }))
      });
    }

    // Insert course assignments only for valid targets
    if (validTargets.length === 0) {
      return res.status(400).json({ error: 'No new assignments to create' });
    }

    const insertAssignment = db.prepare(`
      INSERT INTO course_assignments (id, course_id, target_type, target_id, assigned_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((assignments: Array<{ type: string; id: string }>) => {
      for (const target of assignments) {
        const id = nanoid();
        insertAssignment.run(id, courseId, target.type, target.id, assignedBy);
      }
    });

    insertMany(validTargets);
    res.json({ 
      message: `Course assigned successfully to ${validTargets.length} target(s)`,
      assigned: validTargets.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign course' });
  }
});

// Assign topic to students/classes
courseAssignmentRoutes.post('/topics/assign', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { topicId, targets } = req.body as { topicId: string; targets: Array<{ type: 'student' | 'class'; id: string }> };
  const assignedBy = (req as any).user.sub as string;

  try {
    // Check if topic exists
    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check for existing assignments to prevent duplicates
    const existingAssignments = db.prepare(`
      SELECT target_type, target_id FROM topic_assignments 
      WHERE topic_id = ? AND target_type = ? AND target_id = ?
    `);

    const duplicates: Array<{ type: string; id: string; name: string }> = [];
    const validTargets: Array<{ type: string; id: string }> = [];

    for (const target of targets) {
      const existing = existingAssignments.get(topicId, target.type, target.id);
      if (existing) {
        // Get the name of the duplicate target for better error message
        let targetName = '';
        if (target.type === 'class') {
          const classInfo = db.prepare('SELECT name FROM classes WHERE id = ?').get(target.id) as { name: string } | undefined;
          targetName = classInfo?.name || target.id;
        } else {
          const userInfo = db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').get(target.id) as { first_name: string; last_name: string } | undefined;
          targetName = userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : target.id;
        }
        duplicates.push({ type: target.type, id: target.id, name: targetName });
      } else {
        validTargets.push(target);
      }
    }

    // If there are duplicates, return error with details
    if (duplicates.length > 0) {
      const duplicateMessages = duplicates.map(d => 
        `${d.name} (${d.type})`
      ).join(', ');
      return res.status(409).json({ 
        error: `Topic is already assigned to: ${duplicateMessages}`,
        duplicates: duplicates.map(d => ({ type: d.type, id: d.id, name: d.name }))
      });
    }

    // Insert topic assignments only for valid targets
    if (validTargets.length === 0) {
      return res.status(400).json({ error: 'No new assignments to create' });
    }

    const insertAssignment = db.prepare(`
      INSERT INTO topic_assignments (id, topic_id, target_type, target_id, assigned_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((assignments: Array<{ type: string; id: string }>) => {
      for (const target of assignments) {
        const id = nanoid();
        insertAssignment.run(id, topicId, target.type, target.id, assignedBy);
      }
    });

    insertMany(validTargets);
    res.json({ 
      message: `Topic assigned successfully to ${validTargets.length} target(s)`,
      assigned: validTargets.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign topic' });
  }
});

// Get student's assigned courses and topics with lessons
courseAssignmentRoutes.get('/my-content', requireAuth, requireRole(['student']), (req, res) => {
  const studentId = (req as any).user.sub as string;

  try {
    // Get assigned courses
    const assignedCourses = db.prepare(`
      SELECT DISTINCT c.id, c.title, c.description, ca.assigned_at,
        u.first_name as assigned_by_name, u.last_name as assigned_by_lastname
      FROM courses c
      JOIN course_assignments ca ON c.id = ca.course_id
      LEFT JOIN users u ON ca.assigned_by = u.id
      WHERE (ca.target_type = 'student' AND ca.target_id = ?) 
         OR (ca.target_type = 'class' AND ca.target_id IN (
           SELECT class_id FROM class_students WHERE student_id = ?
         ))
      ORDER BY ca.assigned_at DESC
    `).all(studentId, studentId) as any[];

    // Get assigned topics
    const assignedTopics = db.prepare(`
      SELECT DISTINCT t.id, t.title, t.description, t.position, ta.assigned_at,
        c.title as course_title, u.first_name as assigned_by_name, u.last_name as assigned_by_lastname
      FROM topics t
      JOIN topic_assignments ta ON t.id = ta.topic_id
      LEFT JOIN courses c ON t.course_id = c.id
      LEFT JOIN users u ON ta.assigned_by = u.id
      WHERE (ta.target_type = 'student' AND ta.target_id = ?) 
         OR (ta.target_type = 'class' AND ta.target_id IN (
           SELECT class_id FROM class_students WHERE student_id = ?
         ))
      ORDER BY ta.assigned_at DESC
    `).all(studentId, studentId) as any[];

    // Get lessons for assigned courses
    const courseLessons = db.prepare(`
      SELECT DISTINCT l.id, l.title, l.description, l.created_at,
        c.title as course_title, t.title as topic_title, t.position as topic_position,
        'course' as source_type, c.id as source_id
      FROM lessons l
      JOIN topic_lessons tl ON l.id = tl.lesson_id
      JOIN topics t ON tl.topic_id = t.id
      JOIN courses c ON t.course_id = c.id
      JOIN course_assignments ca ON c.id = ca.course_id
      WHERE (ca.target_type = 'student' AND ca.target_id = ?) 
         OR (ca.target_type = 'class' AND ca.target_id IN (
           SELECT class_id FROM class_students WHERE student_id = ?
         ))
      ORDER BY c.title, t.position, tl.position
    `).all(studentId, studentId) as any[];

    // Get lessons for assigned topics
    const topicLessons = db.prepare(`
      SELECT DISTINCT l.id, l.title, l.description, l.created_at,
        c.title as course_title, t.title as topic_title, t.position as topic_position,
        'topic' as source_type, t.id as source_id
      FROM lessons l
      JOIN topic_lessons tl ON l.id = tl.lesson_id
      JOIN topics t ON tl.topic_id = t.id
      LEFT JOIN courses c ON t.course_id = c.id
      JOIN topic_assignments ta ON t.id = ta.topic_id
      WHERE (ta.target_type = 'student' AND ta.target_id = ?) 
         OR (ta.target_type = 'class' AND ta.target_id IN (
           SELECT class_id FROM class_students WHERE student_id = ?
         ))
      ORDER BY t.title, tl.position
    `).all(studentId, studentId) as any[];

    // Combine and deduplicate lessons
    const allLessons = [...courseLessons, ...topicLessons];
    const uniqueLessons = allLessons.filter((lesson, index, self) => 
      index === self.findIndex(l => l.id === lesson.id)
    );

    res.json({
      courses: assignedCourses,
      topics: assignedTopics,
      lessons: uniqueLessons
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load content' });
  }
});

// Get all course assignments (admin/teacher)
courseAssignmentRoutes.get('/courses/assignments', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT ca.id, ca.course_id, ca.target_type, ca.target_id, ca.assigned_at,
        c.title as course_title, c.description as course_description,
        u.first_name as assigned_by_name, u.last_name as assigned_by_lastname,
        CASE 
          WHEN ca.target_type = 'student' THEN s.first_name || ' ' || s.last_name
          WHEN ca.target_type = 'class' THEN cl.name
        END as target_name
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      LEFT JOIN users u ON ca.assigned_by = u.id
      LEFT JOIN users s ON ca.target_type = 'student' AND ca.target_id = s.id
      LEFT JOIN classes cl ON ca.target_type = 'class' AND ca.target_id = cl.id
      ORDER BY ca.assigned_at DESC
    `).all() as any[];

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load course assignments' });
  }
});

// Get all topic assignments (admin/teacher)
courseAssignmentRoutes.get('/topics/assignments', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT ta.id, ta.topic_id, ta.target_type, ta.target_id, ta.assigned_at,
        t.title as topic_title, t.description as topic_description,
        c.title as course_title,
        u.first_name as assigned_by_name, u.last_name as assigned_by_lastname,
        CASE 
          WHEN ta.target_type = 'student' THEN s.first_name || ' ' || s.last_name
          WHEN ta.target_type = 'class' THEN cl.name
        END as target_name
      FROM topic_assignments ta
      JOIN topics t ON ta.topic_id = t.id
      LEFT JOIN courses c ON t.course_id = c.id
      LEFT JOIN users u ON ta.assigned_by = u.id
      LEFT JOIN users s ON ta.target_type = 'student' AND ta.target_id = s.id
      LEFT JOIN classes cl ON ta.target_type = 'class' AND ta.target_id = cl.id
      ORDER BY ta.assigned_at DESC
    `).all() as any[];

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load topic assignments' });
  }
});

// Remove course assignment
courseAssignmentRoutes.delete('/courses/:assignmentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId } = req.params;

  try {
    const result = db.prepare('DELETE FROM course_assignments WHERE id = ?').run(assignmentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Course assignment not found' });
    }

    res.json({ message: 'Course assignment removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove course assignment' });
  }
});

// Remove topic assignment
courseAssignmentRoutes.delete('/topics/:assignmentId', requireAuth, requireRole(['admin','teacher']), (req, res) => {
  const { assignmentId } = req.params;

  try {
    const result = db.prepare('DELETE FROM topic_assignments WHERE id = ?').run(assignmentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Topic assignment not found' });
    }

    res.json({ message: 'Topic assignment removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove topic assignment' });
  }
});
