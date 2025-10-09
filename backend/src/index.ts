import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import { runMigrations } from './db.js';
import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { classRoutes } from './routes/classRoutes.js';
import { lessonRoutes } from './routes/lessonRoutes.js';
import { assignmentRoutes } from './routes/assignmentRoutes.js';
import { uploadsRoutes } from './routes/uploadsRoutes.js';
import { assessmentRoutes } from './routes/assessmentRoutes.js';
import { curriculumRoutes } from './routes/curriculumRoutes.js';
import { curriculumExportRoutes } from './routes/curriculumExportRoutes.js';
import { courseAssignmentRoutes } from './routes/courseAssignmentRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { importExportRoutes } from './routes/importExportRoutes.js';
import { statusRoutes } from './routes/statusRoutes.js';

const app = express();

const BASE_PATH = process.env.BASE_PATH || '';
console.log('🔧 BASE_PATH from env:', process.env.BASE_PATH);
console.log('🔧 Resolved BASE_PATH:', BASE_PATH);

console.log('🚀 Starting SchoolMaster backend...');
console.log('📁 Current working directory:', process.cwd());
console.log('📁 Directory contents:', fs.readdirSync(process.cwd()));

runMigrations();

app.use((req, _res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://player.vimeo.com"],
      childSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://player.vimeo.com"],
    },
  },
}));
app.use(express.json({ limit: '10mb' }));
const clientOrigin = process.env.CLIENT_ORIGIN;
console.log('🔧 CORS Origin:', clientOrigin);
if (clientOrigin) {
  app.use(cors({ origin: clientOrigin.split(','), credentials: true }));
} else {
  console.log('⚠️ No CLIENT_ORIGIN set, CORS not configured');
}

// API at root
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/test', (_req, res) => res.json({ message: 'API is working!', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/curriculum-export', curriculumExportRoutes);
app.use('/api/course-assignments', courseAssignmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/import-export', importExportRoutes);
app.use('/api/status', statusRoutes);

console.log('🔍 Registered API routes at root (/api/*)');

// Static files
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data', 'uploads');
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

const frontendDistEnv = process.env.FRONTEND_DIST_PATH;
const candidateFrontendDistPaths = [
  frontendDistEnv ? path.resolve(frontendDistEnv) : '',
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
].filter(Boolean);

let frontendDist = '' as string;
for (const candidate of candidateFrontendDistPaths) {
  if (fs.existsSync(candidate)) {
    frontendDist = candidate;
    break;
  }
}

console.log('Frontend dist candidates:', candidateFrontendDistPaths);
console.log('Selected frontend dist path:', frontendDist || '(not found)');
if (frontendDist && fs.existsSync(frontendDist)) {
  try { console.log('Frontend dist contents:', fs.readdirSync(frontendDist)); } catch {}
}

if (frontendDist && fs.existsSync(frontendDist)) {
  // Get base path from environment, default to root
  const basePath = (process.env.BASE_PATH || '').replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
  const baseUrl = basePath ? `/${basePath}` : '';
  
  console.log('🔧 Frontend base path:', basePath || '(root)');
  console.log('🔧 Frontend base URL:', baseUrl || '/');

  if (basePath) {
    // Subdirectory deployment (e.g., /schoolydemo2)
    app.use(baseUrl, express.static(frontendDist));
    app.get('/', (_req, res) => res.redirect(baseUrl));
    app.get(baseUrl, (_req, res) => {
      const indexFile = path.join(frontendDist, 'index.html');
      return res.sendFile(indexFile);
    });
    app.get(`${baseUrl}/*`, (req, res, next) => {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith(`${baseUrl}/assets/`) || url.startsWith('/api/')) return next();
      const indexFile = path.join(frontendDist, 'index.html');
      if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
      return next();
    });
    app.get('/*', (req, res, next) => {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith('/api/') || url.startsWith(`${baseUrl}/assets/`) || url === '/favicon.ico') {
        return next();
      }
      return res.redirect(baseUrl);
    });
  } else {
    // Root deployment
    app.use(express.static(frontendDist));
    app.get('/*', (req, res, next) => {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith('/api/') || url === '/favicon.ico') return next();
      const indexFile = path.join(frontendDist, 'index.html');
      if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
      return next();
    });
  }
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`🚀 API listening on port :${port}`);
  console.log(`📊 Environment: NODE_ENV=${process.env.NODE_ENV}`);
});



