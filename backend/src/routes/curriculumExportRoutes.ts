import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { nanoid } from 'nanoid';

export const curriculumExportRoutes = Router();

const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data', 'uploads');

// Configure multer for ZIP file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

/**
 * Export a course with all topics and lessons as ZIP
 * GET /api/curriculum-export/course/:courseId
 */
curriculumExportRoutes.get('/course/:courseId', requireAuth, requireRole(['admin', 'teacher']), (req, res) => {
  try {
    const { courseId } = req.params;
    console.log(`📦 Exporting course ${courseId}...`);

    // Get course data
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get all topics in the course
    const topics = db.prepare('SELECT * FROM topics WHERE course_id = ? ORDER BY position').all(courseId);
    
    // Get all lessons in all topics
    const topicIds = (topics as any[]).map(t => t.id);
    let lessons: any[] = [];
    let topicLessons: any[] = [];
    
    if (topicIds.length > 0) {
      const placeholders = topicIds.map(() => '?').join(',');
      topicLessons = db.prepare(`SELECT * FROM topic_lessons WHERE topic_id IN (${placeholders})`).all(...topicIds) as any[];
      
      const lessonIds = [...new Set(topicLessons.map(tl => tl.lesson_id))];
      if (lessonIds.length > 0) {
        const lessonPlaceholders = lessonIds.map(() => '?').join(',');
        lessons = db.prepare(`SELECT * FROM lessons WHERE id IN (${lessonPlaceholders})`).all(...lessonIds) as any[];
      }
    }

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        type: 'course',
        courseId: course.id
      },
      course,
      topics,
      topicLessons,
      lessons
    };

    console.log(`📊 Export summary:
      - Course: ${course.title}
      - Topics: ${topics.length}
      - Topic-Lesson links: ${topicLessons.length}
      - Lessons: ${lessons.length}
    `);

    const timestamp = new Date().toISOString().split('T')[0];
    const safeCourseTitle = course.title.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `course-${safeCourseTitle}-${timestamp}.zip`;

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
    const readme = `# Course Export: ${course.title}
Export Date: ${exportData.metadata.exportDate}

This archive contains:
- Course: ${course.title}
- Topics: ${topics.length}
- Lessons: ${lessons.length}
- All assets (images, videos, documents) used in lessons

## Import Instructions

1. Go to Curriculum page in School Master
2. Click "Import Course/Topic"
3. Select this ZIP file
4. The course and all its content will be imported
`;

    archive.append(readme, { name: 'README.txt' });

    // Extract all asset filenames from lesson content
    const assetFiles = new Set<string>();
    for (const lesson of lessons) {
      try {
        const content = JSON.parse(lesson.content_json);
        // Extract image and video URLs from lesson blocks
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'image' && block.content) {
              const match = block.content.match(/\/api\/uploads\/(.+)/);
              if (match) assetFiles.add(match[1]);
            }
            if (block.type === 'video' && block.content) {
              const match = block.content.match(/\/api\/uploads\/(.+)/);
              if (match) assetFiles.add(match[1]);
            }
            if (block.type === 'columns' && Array.isArray(block.columns)) {
              for (const col of block.columns) {
                if (Array.isArray(col.content)) {
                  for (const colBlock of col.content) {
                    if ((colBlock.type === 'image' || colBlock.type === 'video') && colBlock.content) {
                      const match = colBlock.content.match(/\/api\/uploads\/(.+)/);
                      if (match) assetFiles.add(match[1]);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing lesson content:', e);
      }
    }

    // Add assets to ZIP
    if (fs.existsSync(uploadsDir)) {
      console.log(`📁 Adding ${assetFiles.size} assets...`);
      for (const file of assetFiles) {
        const filePath = path.join(uploadsDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `uploads/${file}` });
        }
      }
    }

    console.log('✅ Course export complete');
    archive.finalize();
  } catch (error) {
    console.error('❌ Export failed:', error);
    res.status(500).json({ error: 'Failed to export course: ' + (error as Error).message });
  }
});

/**
 * Export a topic with all lessons as ZIP
 * GET /api/curriculum-export/topic/:topicId
 */
curriculumExportRoutes.get('/topic/:topicId', requireAuth, requireRole(['admin', 'teacher']), (req, res) => {
  try {
    const { topicId } = req.params;
    console.log(`📦 Exporting topic ${topicId}...`);

    // Get topic data
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId) as any;
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Get course for reference
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(topic.course_id) as any;
    
    // Get all lessons in the topic
    const topicLessons = db.prepare('SELECT * FROM topic_lessons WHERE topic_id = ? ORDER BY position').all(topicId) as any[];
    
    const lessonIds = topicLessons.map(tl => tl.lesson_id);
    let lessons: any[] = [];
    
    if (lessonIds.length > 0) {
      const placeholders = lessonIds.map(() => '?').join(',');
      lessons = db.prepare(`SELECT * FROM lessons WHERE id IN (${placeholders})`).all(...lessonIds) as any[];
    }

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        type: 'topic',
        topicId: topic.id
      },
      course,
      topic,
      topicLessons,
      lessons
    };

    console.log(`📊 Export summary:
      - Topic: ${topic.title}
      - Course: ${course?.title || 'N/A'}
      - Topic-Lesson links: ${topicLessons.length}
      - Lessons: ${lessons.length}
    `);

    const timestamp = new Date().toISOString().split('T')[0];
    const safeTopicTitle = topic.title.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `topic-${safeTopicTitle}-${timestamp}.zip`;

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
    const readme = `# Topic Export: ${topic.title}
Export Date: ${exportData.metadata.exportDate}
Course: ${course?.title || 'Unknown'}

This archive contains:
- Topic: ${topic.title}
- Lessons: ${lessons.length}
- All assets (images, videos, documents) used in lessons

## Import Instructions

1. Go to Curriculum page in School Master
2. Click "Import Course/Topic"
3. Select this ZIP file
4. The topic and all its content will be imported
`;

    archive.append(readme, { name: 'README.txt' });

    // Extract all asset filenames from lesson content
    const assetFiles = new Set<string>();
    for (const lesson of lessons) {
      try {
        const content = JSON.parse(lesson.content_json);
        // Extract image and video URLs from lesson blocks
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'image' && block.content) {
              const match = block.content.match(/\/api\/uploads\/(.+)/);
              if (match) assetFiles.add(match[1]);
            }
            if (block.type === 'video' && block.content) {
              const match = block.content.match(/\/api\/uploads\/(.+)/);
              if (match) assetFiles.add(match[1]);
            }
            if (block.type === 'columns' && Array.isArray(block.columns)) {
              for (const col of block.columns) {
                if (Array.isArray(col.content)) {
                  for (const colBlock of col.content) {
                    if ((colBlock.type === 'image' || colBlock.type === 'video') && colBlock.content) {
                      const match = colBlock.content.match(/\/api\/uploads\/(.+)/);
                      if (match) assetFiles.add(match[1]);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing lesson content:', e);
      }
    }

    // Add assets to ZIP
    if (fs.existsSync(uploadsDir)) {
      console.log(`📁 Adding ${assetFiles.size} assets...`);
      for (const file of assetFiles) {
        const filePath = path.join(uploadsDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `uploads/${file}` });
        }
      }
    }

    console.log('✅ Topic export complete');
    archive.finalize();
  } catch (error) {
    console.error('❌ Export failed:', error);
    res.status(500).json({ error: 'Failed to export topic: ' + (error as Error).message });
  }
});

/**
 * Import a course or topic from ZIP
 * POST /api/curriculum-export/import
 */
curriculumExportRoutes.post('/import', requireAuth, requireRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    console.log('🔐 Import route hit - checking auth...');
    console.log('🔐 req.user:', (req as any).user);
    console.log('🔐 req.headers.authorization:', req.headers.authorization);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('📦 Importing curriculum ZIP...');

    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    // Find and read data.json
    const dataEntry = zipEntries.find(entry => entry.entryName === 'data.json');
    if (!dataEntry) {
      return res.status(400).json({ error: 'Invalid curriculum export file (missing data.json)' });
    }

    const exportData = JSON.parse(dataEntry.getData().toString('utf8'));
    const currentUser = (req as any).user;
    const currentUserId = currentUser?.sub; // JWT uses 'sub' for user ID

    if (!currentUserId) {
      console.log('❌ No currentUserId found in JWT token');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('✅ User authenticated, ID:', currentUserId);

    console.log(`📊 Import data summary:
      - Type: ${exportData.metadata.type}
      - Topics in data: ${exportData.topics?.length || (exportData.topic ? 1 : 0)}
      - Lessons in data: ${exportData.lessons?.length || 0}
      - Topic-Lesson links: ${exportData.topicLessons?.length || 0}
      - Importing as user: ${currentUserId}
    `);

    let importedCourse = null;
    let importedTopics = 0;
    let importedLessons = 0;
    let importedAssets = 0;

    // Start transaction
    const transaction = db.transaction(() => {
      // Import based on type
      if (exportData.metadata.type === 'course') {
        // Import course
        const newCourseId = nanoid();
        db.prepare('INSERT INTO courses (id, title, description) VALUES (?, ?, ?)')
          .run(newCourseId, exportData.course.title + ' (Imported)', exportData.course.description || null);
        
        importedCourse = newCourseId;

        // Import topics
        const topicIdMap = new Map();
        for (const topic of exportData.topics || []) {
          const newTopicId = nanoid();
          topicIdMap.set(topic.id, newTopicId);
          db.prepare('INSERT INTO topics (id, course_id, title, description, position) VALUES (?, ?, ?, ?, ?)')
            .run(newTopicId, newCourseId, topic.title, topic.description || null, topic.position || 0);
          importedTopics++;
        }

        // Import lessons
        const lessonIdMap = new Map();
        for (const lesson of exportData.lessons || []) {
          const newLessonId = nanoid();
          lessonIdMap.set(lesson.id, newLessonId);
          console.log(`📝 Importing lesson: ${lesson.title}, created_by will be: ${currentUserId}`);
          db.prepare('INSERT INTO lessons (id, title, description, content_json, created_by) VALUES (?, ?, ?, ?, ?)')
            .run(newLessonId, lesson.title, lesson.description || null, lesson.content_json, currentUserId);
          importedLessons++;
        }

        // Import topic-lesson relationships
        for (const tl of exportData.topicLessons || []) {
          const newTopicId = topicIdMap.get(tl.topic_id);
          const newLessonId = lessonIdMap.get(tl.lesson_id);
          if (newTopicId && newLessonId) {
            db.prepare('INSERT INTO topic_lessons (topic_id, lesson_id, position) VALUES (?, ?, ?)')
              .run(newTopicId, newLessonId, tl.position || 0);
          }
        }
      } else if (exportData.metadata.type === 'topic') {
        // Import topic (need to assign to a course)
        // For now, create a new course for the topic or find existing course
        let targetCourseId = exportData.course?.id;
        
        // Check if course exists
        const existingCourse = targetCourseId ? db.prepare('SELECT id FROM courses WHERE id = ?').get(targetCourseId) : null;
        
        if (!existingCourse) {
          // Create new course
          targetCourseId = nanoid();
          const courseTitle = exportData.course?.title || 'Imported Course';
          db.prepare('INSERT INTO courses (id, title, description) VALUES (?, ?, ?)')
            .run(targetCourseId, courseTitle, exportData.course?.description || null);
          importedCourse = targetCourseId;
        }

        // Import topic
        const newTopicId = nanoid();
        db.prepare('INSERT INTO topics (id, course_id, title, description, position) VALUES (?, ?, ?, ?, ?)')
          .run(newTopicId, targetCourseId, exportData.topic.title + ' (Imported)', exportData.topic.description || null, exportData.topic.position || 0);
        importedTopics++;

        // Import lessons
        const lessonIdMap = new Map();
        for (const lesson of exportData.lessons || []) {
          const newLessonId = nanoid();
          lessonIdMap.set(lesson.id, newLessonId);
          console.log(`📝 Importing lesson: ${lesson.title}, created_by will be: ${currentUserId}`);
          db.prepare('INSERT INTO lessons (id, title, description, content_json, created_by) VALUES (?, ?, ?, ?, ?)')
            .run(newLessonId, lesson.title, lesson.description || null, lesson.content_json, currentUserId);
          importedLessons++;
        }

        // Import topic-lesson relationships
        for (const tl of exportData.topicLessons || []) {
          const newLessonId = lessonIdMap.get(tl.lesson_id);
          if (newLessonId) {
            db.prepare('INSERT INTO topic_lessons (topic_id, lesson_id, position) VALUES (?, ?, ?)')
              .run(newTopicId, newLessonId, tl.position || 0);
          }
        }
      }
    });

    transaction();

    console.log(`✅ Import transaction complete:
      - Course: ${importedCourse ? 'Created' : 'Used existing'}
      - Topics imported: ${importedTopics}
      - Lessons imported: ${importedLessons}
    `);

    // Import assets
    const uploadsEntry = zipEntries.find(entry => entry.entryName.startsWith('uploads/'));
    if (uploadsEntry) {
      const assetEntries = zipEntries.filter(entry => entry.entryName.startsWith('uploads/') && !entry.isDirectory);
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      for (const entry of assetEntries) {
        const fileName = path.basename(entry.entryName);
        const targetPath = path.join(uploadsDir, fileName);
        
        // Only write if file doesn't exist (avoid overwriting)
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, entry.getData());
          importedAssets++;
        }
      }
    }

    console.log('✅ Import complete');
    res.json({
      success: true,
      message: `Imported successfully: ${importedTopics} topics, ${importedLessons} lessons, ${importedAssets} assets`,
      imported: {
        course: importedCourse,
        topics: importedTopics,
        lessons: importedLessons,
        assets: importedAssets
      }
    });
  } catch (error) {
    console.error('❌ Import failed:', error);
    res.status(500).json({ error: 'Failed to import curriculum: ' + (error as Error).message });
  }
});

