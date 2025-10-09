import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { Readable } from 'stream';
import multer from 'multer';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import AdmZip from 'adm-zip';

export const importExportRoutes = Router();

const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data', 'uploads');

// Helper to check if setup is complete
function isSetupComplete(): boolean {
  try {
    const schoolName = db.prepare('SELECT value FROM settings WHERE key = ?').get('school_name') as { value: string } | undefined;
    const adminPasswordSet = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND password_hash IS NOT NULL').get('admin') as { count: number };
    return !!(schoolName && adminPasswordSet.count > 0);
  } catch (error) {
    return false;
  }
}

// Configure multer for ZIP file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

interface ExportData {
  metadata: {
    exportDate: string;
    version: string;
    databaseVersion: string;
  };
  settings: any[];
  users: any[];
  classes: any[];
  classStudents: any[];
  lessons: any[];
  assessments: any[];
  courses: any[];
  topics: any[];
  topicLessons: any[];
  assignments: any[];
  assignmentTargets: any[];
  courseAssignments: any[];
  topicAssignments: any[];
  attempts: any[];
  assignmentProgress: any[];
  assignmentAccess: any[];
}

/**
 * Export all system data as JSON
 * GET /api/import-export/export
 */
importExportRoutes.get('/export', requireAuth, requireRole(['admin']), (req, res) => {
  try {
    console.log('📦 Starting complete data export...');

    // Export all tables
    const exportData: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '3.0.0',
        databaseVersion: '1.0.0'
      },
      settings: db.prepare('SELECT * FROM settings').all(),
      users: db.prepare('SELECT * FROM users').all(),
      classes: db.prepare('SELECT * FROM classes').all(),
      classStudents: db.prepare('SELECT * FROM class_students').all(),
      lessons: db.prepare('SELECT * FROM lessons').all(),
      assessments: db.prepare('SELECT * FROM assessments').all(),
      courses: db.prepare('SELECT * FROM courses').all(),
      topics: db.prepare('SELECT * FROM topics').all(),
      topicLessons: db.prepare('SELECT * FROM topic_lessons').all(),
      assignments: db.prepare('SELECT * FROM assignments').all(),
      assignmentTargets: db.prepare('SELECT * FROM assignment_targets').all(),
      courseAssignments: db.prepare('SELECT * FROM course_assignments').all(),
      topicAssignments: db.prepare('SELECT * FROM topic_assignments').all(),
      attempts: db.prepare('SELECT * FROM attempts').all(),
      assignmentProgress: db.prepare('SELECT * FROM assignment_progress').all(),
      assignmentAccess: db.prepare('SELECT * FROM assignment_access').all()
    };

    console.log('✅ Data export complete:', {
      users: exportData.users.length,
      lessons: exportData.lessons.length,
      assessments: exportData.assessments.length,
      courses: exportData.courses.length,
      topics: exportData.topics.length,
      assignments: exportData.assignments.length
    });

    res.json(exportData);
  } catch (error) {
    console.error('❌ Export failed:', error);
    res.status(500).json({ error: 'Failed to export data: ' + (error as Error).message });
  }
});

/**
 * Export complete system as ZIP archive with assets
 * GET /api/import-export/export-zip
 */
importExportRoutes.get('/export-zip', requireAuth, requireRole(['admin']), (req, res) => {
  try {
    console.log('📦 Starting complete ZIP export...');

    // Get all data
    const exportData: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '3.0.0',
        databaseVersion: '1.0.0'
      },
      settings: db.prepare('SELECT * FROM settings').all(),
      users: db.prepare('SELECT * FROM users').all(),
      classes: db.prepare('SELECT * FROM classes').all(),
      classStudents: db.prepare('SELECT * FROM class_students').all(),
      lessons: db.prepare('SELECT * FROM lessons').all(),
      assessments: db.prepare('SELECT * FROM assessments').all(),
      courses: db.prepare('SELECT * FROM courses').all(),
      topics: db.prepare('SELECT * FROM topics').all(),
      topicLessons: db.prepare('SELECT * FROM topic_lessons').all(),
      assignments: db.prepare('SELECT * FROM assignments').all(),
      assignmentTargets: db.prepare('SELECT * FROM assignment_targets').all(),
      courseAssignments: db.prepare('SELECT * FROM course_assignments').all(),
      topicAssignments: db.prepare('SELECT * FROM topic_assignments').all(),
      attempts: db.prepare('SELECT * FROM attempts').all(),
      assignmentProgress: db.prepare('SELECT * FROM assignment_progress').all(),
      assignmentAccess: db.prepare('SELECT * FROM assignment_access').all()
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `school-master-complete-export-${timestamp}.zip`;

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err: Error) => {
      console.error('❌ Archive error:', err);
      res.status(500).json({ error: 'Failed to create archive' });
    });

    archive.pipe(res);

    // Add data as JSON file
    archive.append(JSON.stringify(exportData, null, 2), { name: 'data.json' });

    // Add README
    const readme = `# School Master Complete Backup
Export Date: ${exportData.metadata.exportDate}
Version: ${exportData.metadata.version}

This archive contains a complete backup of your School Master system including:
- All system settings
- All users (${exportData.users.length})
- All classes (${exportData.classes.length})
- All lessons (${exportData.lessons.length})
- All assessments (${exportData.assessments.length})
- All courses (${exportData.courses.length})
- All topics (${exportData.topics.length})
- All assignments (${exportData.assignments.length})
- All student progress and attempts
- All uploaded files (images, videos, documents)

## Import Instructions

1. Go to Import/Export page in School Master
2. Click "Import Complete Backup"
3. Select this ZIP file
4. Wait for the import to complete

IMPORTANT: Importing this file will REPLACE ALL existing data in the target system.
Make sure you have a backup of the target system before importing.
`;

    archive.append(readme, { name: 'README.txt' });

    // Add uploads directory if it exists
    if (fs.existsSync(uploadsDir)) {
      console.log('📁 Adding uploads directory...');
      const files = fs.readdirSync(uploadsDir);
      console.log(`Found ${files.length} uploaded files`);
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile()) {
          archive.file(filePath, { name: `uploads/${file}` });
        }
      }
    }

    console.log('✅ ZIP export complete');
    archive.finalize();
  } catch (error) {
    console.error('❌ Export failed:', error);
    res.status(500).json({ error: 'Failed to export data: ' + (error as Error).message });
  }
});

/**
 * Import complete system from ZIP archive
 * POST /api/import-export/import-zip
 */
importExportRoutes.post('/import-zip', (req, res, next) => {
  // Allow unauthenticated access during setup, otherwise require admin auth
  if (isSetupComplete()) {
    requireAuth(req, res, (err?: any) => {
      if (err) return next(err);
      requireRole(['admin'])(req as any, res, next);
    });
  } else {
    // During setup, skip auth
    next();
  }
}, upload.single('file'), async (req, res) => {
  try {
    console.log('📥 Starting complete ZIP import...');

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const importOptions = {
      clearExisting: req.body.clearExisting === 'true',
      importUsers: req.body.importUsers !== 'false',
      importProgress: req.body.importProgress !== 'false',
      importAssets: req.body.importAssets !== 'false'
    };

    console.log('Import options:', importOptions);

    // Parse ZIP file
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    // Extract data.json
    const dataEntry = zipEntries.find(entry => entry.entryName === 'data.json');
    if (!dataEntry) {
      return res.status(400).json({ error: 'Invalid backup file: data.json not found' });
    }

    const dataContent = dataEntry.getData().toString('utf8');
    const importData: ExportData = JSON.parse(dataContent);

    console.log('📋 Import data parsed:', {
      users: importData.users?.length || 0,
      lessons: importData.lessons?.length || 0,
      assessments: importData.assessments?.length || 0,
      courses: importData.courses?.length || 0,
      topics: importData.topics?.length || 0
    });

    const result = {
      success: true,
      message: 'Import completed successfully',
      imported: {
        settings: 0,
        users: 0,
        classes: 0,
        lessons: 0,
        assessments: 0,
        courses: 0,
        topics: 0,
        assignments: 0,
        courseAssignments: 0,
        topicAssignments: 0,
        attempts: 0,
        assets: 0
      },
      errors: [] as string[]
    };

    // Start transaction
    const importTransaction = db.transaction(() => {
      try {
        // Clear existing data if requested
        if (importOptions.clearExisting) {
          console.log('🗑️  Clearing existing data...');
          
          // Delete in correct order to respect foreign keys
          db.prepare('DELETE FROM assignment_access').run();
          db.prepare('DELETE FROM assignment_progress').run();
          db.prepare('DELETE FROM attempts').run();
          db.prepare('DELETE FROM topic_assignments').run();
          db.prepare('DELETE FROM course_assignments').run();
          db.prepare('DELETE FROM assignment_targets').run();
          db.prepare('DELETE FROM assignments').run();
          db.prepare('DELETE FROM topic_lessons').run();
          db.prepare('DELETE FROM topics').run();
          db.prepare('DELETE FROM courses').run();
          db.prepare('DELETE FROM assessments').run();
          db.prepare('DELETE FROM lessons').run();
          db.prepare('DELETE FROM class_students').run();
          db.prepare('DELETE FROM classes').run();
          
          if (importOptions.importUsers) {
            // Keep at least one admin user
            db.prepare('DELETE FROM users WHERE role != ?').run('admin');
            const adminCount = (db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin') as any).count;
            if (adminCount > 1) {
              // Keep only the first admin
              db.prepare('DELETE FROM users WHERE role = ? AND id NOT IN (SELECT id FROM users WHERE role = ? LIMIT 1)').run('admin', 'admin');
            }
          }
          
          console.log('✅ Existing data cleared');
        }

        // Import settings
        if (importData.settings?.length > 0) {
          const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
          for (const setting of importData.settings) {
            insertSetting.run(setting.key, setting.value, setting.updated_at);
            result.imported.settings++;
          }
          console.log(`✅ Imported ${result.imported.settings} settings`);
        }

        // Import users
        if (importOptions.importUsers && importData.users?.length > 0) {
          const insertUser = db.prepare(`
            INSERT OR REPLACE INTO users 
            (id, email, username, password_hash, role, first_name, last_name, created_at, archived, archived_at, must_change_password) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const user of importData.users) {
            try {
              insertUser.run(
                user.id,
                user.email,
                user.username,
                user.password_hash,
                user.role,
                user.first_name,
                user.last_name,
                user.created_at,
                user.archived || 0,
                user.archived_at || null,
                user.must_change_password || 0
              );
              result.imported.users++;
            } catch (error) {
              result.errors.push(`Failed to import user ${user.email}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.users} users`);
        }

        // Import classes
        if (importData.classes?.length > 0) {
          const insertClass = db.prepare(`
            INSERT OR REPLACE INTO classes 
            (id, name, teacher_id, created_at, archived, archived_at, auto_archive_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const cls of importData.classes) {
            try {
              insertClass.run(
                cls.id,
                cls.name,
                cls.teacher_id,
                cls.created_at,
                cls.archived || 0,
                cls.archived_at || null,
                cls.auto_archive_date || null
              );
              result.imported.classes++;
            } catch (error) {
              result.errors.push(`Failed to import class ${cls.name}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.classes} classes`);
        }

        // Import class_students
        if (importData.classStudents?.length > 0) {
          const insertClassStudent = db.prepare('INSERT OR REPLACE INTO class_students (class_id, student_id) VALUES (?, ?)');
          for (const cs of importData.classStudents) {
            try {
              insertClassStudent.run(cs.class_id, cs.student_id);
            } catch (error) {
              result.errors.push(`Failed to import class student relationship: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${importData.classStudents.length} class-student relationships`);
        }

        // Import lessons
        if (importData.lessons?.length > 0) {
          const insertLesson = db.prepare(`
            INSERT OR REPLACE INTO lessons 
            (id, title, description, content_json, created_by, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const lesson of importData.lessons) {
            try {
              insertLesson.run(
                lesson.id,
                lesson.title,
                lesson.description,
                lesson.content_json,
                lesson.created_by,
                lesson.created_at
              );
              result.imported.lessons++;
            } catch (error) {
              result.errors.push(`Failed to import lesson ${lesson.title}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.lessons} lessons`);
        }

        // Import assessments
        if (importData.assessments?.length > 0) {
          const insertAssessment = db.prepare(`
            INSERT OR REPLACE INTO assessments 
            (id, title, description, content_json, created_by, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const assessment of importData.assessments) {
            try {
              insertAssessment.run(
                assessment.id,
                assessment.title,
                assessment.description,
                assessment.content_json,
                assessment.created_by,
                assessment.created_at
              );
              result.imported.assessments++;
            } catch (error) {
              result.errors.push(`Failed to import assessment ${assessment.title}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.assessments} assessments`);
        }

        // Import courses
        if (importData.courses?.length > 0) {
          const insertCourse = db.prepare('INSERT OR REPLACE INTO courses (id, title, description, created_at) VALUES (?, ?, ?, ?)');
          for (const course of importData.courses) {
            try {
              insertCourse.run(course.id, course.title, course.description, course.created_at);
              result.imported.courses++;
            } catch (error) {
              result.errors.push(`Failed to import course ${course.title}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.courses} courses`);
        }

        // Import topics
        if (importData.topics?.length > 0) {
          const insertTopic = db.prepare('INSERT OR REPLACE INTO topics (id, course_id, title, description, position) VALUES (?, ?, ?, ?, ?)');
          for (const topic of importData.topics) {
            try {
              insertTopic.run(topic.id, topic.course_id, topic.title, topic.description, topic.position);
              result.imported.topics++;
            } catch (error) {
              result.errors.push(`Failed to import topic ${topic.title}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.topics} topics`);
        }

        // Import topic_lessons
        if (importData.topicLessons?.length > 0) {
          const insertTopicLesson = db.prepare('INSERT OR REPLACE INTO topic_lessons (topic_id, lesson_id, position) VALUES (?, ?, ?)');
          for (const tl of importData.topicLessons) {
            try {
              insertTopicLesson.run(tl.topic_id, tl.lesson_id, tl.position);
            } catch (error) {
              result.errors.push(`Failed to import topic-lesson relationship: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${importData.topicLessons.length} topic-lesson relationships`);
        }

        // Import assignments
        if (importData.assignments?.length > 0) {
          const insertAssignment = db.prepare(`
            INSERT OR REPLACE INTO assignments 
            (id, title, type, ref_id, assigned_by, due_at, max_attempts, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const assignment of importData.assignments) {
            try {
              insertAssignment.run(
                assignment.id,
                assignment.title,
                assignment.type,
                assignment.ref_id,
                assignment.assigned_by,
                assignment.due_at,
                assignment.max_attempts,
                assignment.created_at
              );
              result.imported.assignments++;
            } catch (error) {
              result.errors.push(`Failed to import assignment ${assignment.title}: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.assignments} assignments`);
        }

        // Import assignment_targets
        if (importData.assignmentTargets?.length > 0) {
          const insertTarget = db.prepare('INSERT OR REPLACE INTO assignment_targets (assignment_id, target_type, target_id) VALUES (?, ?, ?)');
          for (const target of importData.assignmentTargets) {
            try {
              insertTarget.run(target.assignment_id, target.target_type, target.target_id);
            } catch (error) {
              result.errors.push(`Failed to import assignment target: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${importData.assignmentTargets.length} assignment targets`);
        }

        // Import course_assignments
        if (importData.courseAssignments?.length > 0) {
          const insertCA = db.prepare(`
            INSERT OR REPLACE INTO course_assignments 
            (id, course_id, target_type, target_id, assigned_by, assigned_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const ca of importData.courseAssignments) {
            try {
              insertCA.run(ca.id, ca.course_id, ca.target_type, ca.target_id, ca.assigned_by, ca.assigned_at);
              result.imported.courseAssignments++;
            } catch (error) {
              result.errors.push(`Failed to import course assignment: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.courseAssignments} course assignments`);
        }

        // Import topic_assignments
        if (importData.topicAssignments?.length > 0) {
          const insertTA = db.prepare(`
            INSERT OR REPLACE INTO topic_assignments 
            (id, topic_id, target_type, target_id, assigned_by, assigned_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const ta of importData.topicAssignments) {
            try {
              insertTA.run(ta.id, ta.topic_id, ta.target_type, ta.target_id, ta.assigned_by, ta.assigned_at);
              result.imported.topicAssignments++;
            } catch (error) {
              result.errors.push(`Failed to import topic assignment: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.topicAssignments} topic assignments`);
        }

        // Import attempts (if importProgress is true)
        if (importOptions.importProgress && importData.attempts?.length > 0) {
          const insertAttempt = db.prepare(`
            INSERT OR REPLACE INTO attempts 
            (id, assignment_id, student_id, score, max_score, submitted_at, data_json) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const attempt of importData.attempts) {
            try {
              insertAttempt.run(
                attempt.id,
                attempt.assignment_id,
                attempt.student_id,
                attempt.score,
                attempt.max_score,
                attempt.submitted_at,
                attempt.data_json
              );
              result.imported.attempts++;
            } catch (error) {
              result.errors.push(`Failed to import attempt: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${result.imported.attempts} attempts`);
        }

        // Import assignment_progress (if importProgress is true)
        if (importOptions.importProgress && importData.assignmentProgress?.length > 0) {
          const insertProgress = db.prepare(`
            INSERT OR REPLACE INTO assignment_progress 
            (id, assignment_id, student_id, data_json, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const progress of importData.assignmentProgress) {
            try {
              insertProgress.run(
                progress.id,
                progress.assignment_id,
                progress.student_id,
                progress.data_json,
                progress.created_at,
                progress.updated_at
              );
            } catch (error) {
              result.errors.push(`Failed to import assignment progress: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${importData.assignmentProgress.length} assignment progress records`);
        }

        // Import assignment_access (if importProgress is true)
        if (importOptions.importProgress && importData.assignmentAccess?.length > 0) {
          const insertAccess = db.prepare(`
            INSERT OR REPLACE INTO assignment_access 
            (id, assignment_id, student_id, accessed_at) 
            VALUES (?, ?, ?, ?)
          `);
          
          for (const access of importData.assignmentAccess) {
            try {
              insertAccess.run(access.id, access.assignment_id, access.student_id, access.accessed_at);
            } catch (error) {
              result.errors.push(`Failed to import assignment access: ${(error as Error).message}`);
            }
          }
          console.log(`✅ Imported ${importData.assignmentAccess.length} assignment access records`);
        }

      } catch (error) {
        throw error;
      }
    });

    // Execute the transaction
    importTransaction();

    // Import assets (files from uploads directory)
    if (importOptions.importAssets) {
      console.log('📁 Importing assets...');
      
      // Ensure uploads directory exists
      fs.mkdirSync(uploadsDir, { recursive: true });
      
      for (const entry of zipEntries as any[]) {
        if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
          try {
            const filename = path.basename(entry.entryName);
            const targetPath = path.join(uploadsDir, filename);
            
            // Extract file
            fs.writeFileSync(targetPath, entry.getData());
            result.imported.assets++;
          } catch (error) {
            result.errors.push(`Failed to import asset ${entry.entryName}: ${(error as Error).message}`);
          }
        }
      }
      
      console.log(`✅ Imported ${result.imported.assets} assets`);
    }

    if (result.errors.length > 0) {
      result.success = false;
      result.message = `Import completed with ${result.errors.length} errors`;
      console.warn('⚠️  Import completed with errors:', result.errors);
    } else {
      console.log('✅ Import completed successfully');
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Import failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to import data: ' + (error as Error).message 
    });
  }
});

/**
 * Get import/export statistics
 * GET /api/import-export/stats
 */
importExportRoutes.get('/stats', requireAuth, requireRole(['admin']), (req, res) => {
  try {
    const stats = {
      users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count,
      classes: (db.prepare('SELECT COUNT(*) as count FROM classes').get() as any).count,
      lessons: (db.prepare('SELECT COUNT(*) as count FROM lessons').get() as any).count,
      assessments: (db.prepare('SELECT COUNT(*) as count FROM assessments').get() as any).count,
      courses: (db.prepare('SELECT COUNT(*) as count FROM courses').get() as any).count,
      topics: (db.prepare('SELECT COUNT(*) as count FROM topics').get() as any).count,
      assignments: (db.prepare('SELECT COUNT(*) as count FROM assignments').get() as any).count,
      attempts: (db.prepare('SELECT COUNT(*) as count FROM attempts').get() as any).count,
      uploadedFiles: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});
