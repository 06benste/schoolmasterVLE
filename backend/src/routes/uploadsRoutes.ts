import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from '../auth.js';

const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});

const upload = multer({ storage });

export const uploadsRoutes = Router();

// Admin can upload media for lessons/assessments
uploadsRoutes.post('/', requireAuth, requireRole(['admin']), upload.single('file'), (req, res) => {
  const file = req.file!;
  res.json({ filename: file.filename, url: `/uploads/${file.filename}` });
});

// Logo upload for school setup (public endpoint)
uploadsRoutes.post('/logo', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
  }
  
  // Validate file size (2MB max)
  if (req.file.size > 2 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large. Maximum size is 2MB.' });
  }
  
  res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

// Image upload specifically for lessons and assessments
uploadsRoutes.post('/image', requireAuth, requireRole(['admin', 'teacher']), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  
  const file = req.file;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    // Delete the uploaded file if it's not a valid image
    fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Only image files are allowed (JPEG, PNG, GIF, WebP)' });
  }
  
  res.json({ 
    filename: file.filename, 
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });
});

// Document upload for lesson documents
uploadsRoutes.post('/document', requireAuth, requireRole(['admin', 'teacher']), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No document file provided' });
  }
  
  const file = req.file;
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav'
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    // Delete the uploaded file if it's not a valid document type
    fs.unlinkSync(file.path);
    return res.status(400).json({ 
      error: 'Only document files are allowed (PDF, Word, Excel, PowerPoint, text, images, videos, audio, archives)' 
    });
  }
  
  res.json({ 
    filename: file.filename, 
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });
});


