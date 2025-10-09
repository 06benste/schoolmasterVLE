import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.js';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';

const statusRoutes = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      message: string;
      responseTime?: number;
    };
    uploads: {
      status: 'healthy' | 'unhealthy';
      message: string;
      directoryExists: boolean;
      writable: boolean;
      fileCount?: number;
    };
    system: {
      status: 'healthy' | 'unhealthy';
      message: string;
      uptime: number;
      memoryUsage: NodeJS.MemoryUsage;
    };
  };
}

// Health check endpoint
statusRoutes.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unhealthy', message: 'Not checked' },
      uploads: { status: 'unhealthy', message: 'Not checked', directoryExists: false, writable: false },
      system: { status: 'unhealthy', message: 'Not checked', uptime: 0, memoryUsage: {} as NodeJS.MemoryUsage }
    }
  };

  try {
    // Database check
    const dbStart = Date.now();
    try {
      const result = db.prepare('SELECT 1 as test').get() as { test: number } | undefined;
      if (result && result.test === 1) {
        healthStatus.checks.database = {
          status: 'healthy',
          message: 'Database connection successful',
          responseTime: Date.now() - dbStart
        };
      } else {
        healthStatus.checks.database = {
          status: 'unhealthy',
          message: 'Database query returned unexpected result'
        };
      }
    } catch (error) {
      healthStatus.checks.database = {
        status: 'unhealthy',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    // Uploads directory check
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    try {
      const dirExists = fs.existsSync(uploadsDir);
      let writable = false;
      let fileCount = 0;

      if (dirExists) {
        try {
          // Test write access
          const testFile = path.join(uploadsDir, '.health-check');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          writable = true;

          // Count files
          const files = fs.readdirSync(uploadsDir);
          fileCount = files.length;
        } catch (error) {
          writable = false;
        }
      }

      if (dirExists && writable) {
        healthStatus.checks.uploads = {
          status: 'healthy',
          message: `Uploads directory accessible with ${fileCount} files`,
          directoryExists: true,
          writable: true,
          fileCount
        };
      } else {
        healthStatus.checks.uploads = {
          status: 'unhealthy',
          message: dirExists ? 'Directory exists but not writable' : 'Uploads directory does not exist',
          directoryExists: dirExists,
          writable
        };
      }
    } catch (error) {
      healthStatus.checks.uploads = {
        status: 'unhealthy',
        message: `Uploads check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        directoryExists: false,
        writable: false
      };
    }

    // System check
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      healthStatus.checks.system = {
        status: 'healthy',
        message: 'System resources available',
        uptime,
        memoryUsage
      };
    } catch (error) {
      healthStatus.checks.system = {
        status: 'unhealthy',
        message: `System check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        uptime: 0,
        memoryUsage: {} as NodeJS.MemoryUsage
      };
    }

    // Determine overall status
    const allHealthy = Object.values(healthStatus.checks).every(check => check.status === 'healthy');
    const anyUnhealthy = Object.values(healthStatus.checks).some(check => check.status === 'unhealthy');
    
    if (allHealthy) {
      healthStatus.status = 'healthy';
    } else if (anyUnhealthy) {
      healthStatus.status = 'unhealthy';
    } else {
      healthStatus.status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    res.json({
      ...healthStatus,
      responseTime
    });

  } catch (error) {
    healthStatus.status = 'unhealthy';
    res.status(500).json({
      ...healthStatus,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detailed status endpoint (admin only)
statusRoutes.get('/status', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    // Get database statistics
    const dbStats = {
      users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number } | undefined)?.count || 0,
      classes: (db.prepare('SELECT COUNT(*) as count FROM classes').get() as { count: number } | undefined)?.count || 0,
      lessons: (db.prepare('SELECT COUNT(*) as count FROM lessons').get() as { count: number } | undefined)?.count || 0,
      assessments: (db.prepare('SELECT COUNT(*) as count FROM assessments').get() as { count: number } | undefined)?.count || 0,
      courses: (db.prepare('SELECT COUNT(*) as count FROM courses').get() as { count: number } | undefined)?.count || 0,
      topics: (db.prepare('SELECT COUNT(*) as count FROM topics').get() as { count: number } | undefined)?.count || 0,
      assignments: (db.prepare('SELECT COUNT(*) as count FROM assignments').get() as { count: number } | undefined)?.count || 0,
      attempts: (db.prepare('SELECT COUNT(*) as count FROM attempts').get() as { count: number } | undefined)?.count || 0
    };

    // Get uploads directory info
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    let uploadsInfo = {
      exists: false,
      writable: false,
      fileCount: 0,
      totalSize: 0
    };

    try {
      if (fs.existsSync(uploadsDir)) {
        uploadsInfo.exists = true;
        
        // Test write access
        const testFile = path.join(uploadsDir, '.health-check');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        uploadsInfo.writable = true;

        // Get file count and total size
        const files = fs.readdirSync(uploadsDir);
        uploadsInfo.fileCount = files.length;
        
        let totalSize = 0;
        for (const file of files) {
          try {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              totalSize += stats.size;
            }
          } catch (error) {
            // Skip files that can't be accessed
          }
        }
        uploadsInfo.totalSize = totalSize;
      }
    } catch (error) {
      // Uploads directory check failed
    }

    // System information
    const systemInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    };

    res.json({
      timestamp: new Date().toISOString(),
      database: dbStats,
      uploads: uploadsInfo,
      system: systemInfo
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get status information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { statusRoutes };
