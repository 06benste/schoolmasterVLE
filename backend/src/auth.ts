import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_please';

export interface JwtPayload {
  sub: string;
  role: 'admin' | 'teacher' | 'student';
}

export function signToken(userId: string, role: JwtPayload['role']) {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  const token = header.replace('Bearer ', '').trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles: JwtPayload['role'][]){
  return (req: Request & { user?: JwtPayload }, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}



