import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import { db, runMigrations } from '../db.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { seedDatabase } from '../seed.js';

const settingsRoutes = Router();

// Get all settings (admin only)
settingsRoutes.get('/', requireAuth, requireRole(['admin']), (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

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

// Update settings (admin only, or during setup)
settingsRoutes.put('/', (req, res, next) => {
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
}, (req, res) => {
  try {
    const settings = req.body as Record<string, string>;
    
    // Update each setting
    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
    
    for (const [key, value] of Object.entries(settings)) {
      updateStmt.run(key, value);
    }
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Check if setup is complete (public endpoint for setup wizard)
settingsRoutes.get('/setup-status', (req, res) => {
  try {
    const schoolName = db.prepare('SELECT value FROM settings WHERE key = ?').get('school_name') as { value: string } | undefined;
    const adminPasswordSet = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ? AND password_hash IS NOT NULL').get('admin') as { count: number };
    
    const isSetupComplete = schoolName && adminPasswordSet.count > 0;
    
    console.log('🔍 Setup status check:', {
      schoolName: schoolName?.value,
      adminCount: adminPasswordSet.count,
      isSetupComplete
    });
    
    res.json({ 
      isSetupComplete: !!isSetupComplete,
      hasSchoolName: !!schoolName,
      hasAdminUser: adminPasswordSet.count > 0
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Complete setup (public endpoint for setup wizard)
settingsRoutes.post('/complete-setup', (req, res) => {
  try {
    console.log('🔧 Complete setup request received:', {
      schoolName: req.body.schoolName,
      logoFile: req.body.logoFile,
      hasPassword: !!req.body.adminPassword
    });
    const { schoolName, adminPassword, logoFile } = req.body as { 
      schoolName: string; 
      adminPassword: string; 
      logoFile?: string; 
    };
    
    if (!schoolName || !adminPassword) {
      return res.status(400).json({ error: 'School name and admin password are required' });
    }
    
    // Update school name setting
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run('school_name', schoolName);
    
    // Update logo setting if provided
    if (logoFile) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run('school_logo', logoFile);
    }
    
    // Update admin password
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    
    // Get the first admin user (created by seed)
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') as { id: string } | undefined;
    
    if (adminUser) {
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashedPassword, adminUser.id);
    } else {
      // Create admin user if none exists
      const adminId = nanoid();
      db.prepare('INSERT INTO users (id, email, username, password_hash, role, first_name, last_name, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(adminId, 'admin@school.local', 'admin', hashedPassword, 'admin', 'Admin', 'User', 0);
    }
    
    res.json({ message: 'Setup completed successfully' });
  } catch (error) {
    console.error('Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// Reset database (admin only) - DANGEROUS!
settingsRoutes.post('/reset-database', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { confirmation, adminPassword } = req.body as { 
      confirmation: string; 
      adminPassword: string; 
    };
    
    // Verify confirmation phrase
    if (confirmation !== 'RESET_DATABASE_CONFIRM') {
      return res.status(400).json({ error: 'Invalid confirmation phrase' });
    }
    
    // Verify admin password
    const adminUser = db.prepare('SELECT password_hash FROM users WHERE role = ? LIMIT 1').get('admin') as { password_hash: string } | undefined;
    if (!adminUser) {
      return res.status(400).json({ error: 'No admin user found' });
    }
    
    if (!bcrypt.compareSync(adminPassword, adminUser.password_hash)) {
      return res.status(400).json({ error: 'Invalid admin password' });
    }
    
    console.log('🚨 DATABASE RESET INITIATED BY ADMIN');
    
    // Drop all tables
    const tables = [
      'settings', 'assignment_access', 'assignment_progress', 'attempts', 
      'assignment_targets', 'topic_assignments', 'course_assignments',
      'topic_lessons', 'topics', 'courses', 'assignments', 'assessments', 
      'lessons', 'class_students', 'classes', 'users'
    ];
    
    tables.forEach(table => {
      try {
        db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
        console.log(`✅ Dropped table: ${table}`);
      } catch (err) {
        console.log(`⚠️ Failed to drop table ${table}:`, err);
      }
    });
    
    // Recreate database schema
    runMigrations();
    
    // Reseed with default admin
    seedDatabase();
    
    console.log('✅ Database reset completed successfully');
    
    res.json({ 
      message: 'Database reset completed successfully. You will be redirected to setup.',
      reset: true 
    });
    
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

export default settingsRoutes;
