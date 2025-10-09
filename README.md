# School Master - Comprehensive Learning Management System

A modern, full-stack learning management system built with React, TypeScript, Express, and SQLite. School Master provides a complete solution for educational institutions to manage courses, lessons, assessments, students, and teachers.

## 🚀 Features

### 📚 Content Management
- **Visual Lesson Builder**: Drag-and-drop interface for creating rich, interactive lessons
- **Assessment Builder**: Create multiple choice, fill-in-the-blank, short answer, and long answer questions
- **Course & Topic Management**: Organize content hierarchically with courses and topics
- **Media Support**: Upload and embed images, videos, and documents
- **Autosave**: Automatic saving of drafts with visual status indicators
- **Version Control**: Track changes with version notes and last edited information

### 👥 User Management
- **Role-Based Access**: Admin, Teacher, and Student roles with appropriate permissions
- **User Import/Export**: Bulk user management with CSV support
- **Password Management**: Secure authentication with password change requirements
- **User Archiving**: Soft delete functionality for user management

### 🎯 Assignment & Assessment
- **Flexible Assignments**: Assign lessons and assessments to classes, courses, or topics
- **Progress Tracking**: Monitor student progress and completion rates
- **Automated Grading**: Auto-grade multiple choice and fill-in-the-blank questions
- **Manual Review**: Review and grade subjective questions
- **Marksheets**: Comprehensive grading and reporting system

### 📊 System Features
- **Quick Search**: Global search (Ctrl+K) to quickly find users, classes, lessons, and assessments
- **Import/Export**: Complete system backup and restore functionality
- **System Health**: Real-time monitoring of database, uploads, and system resources
- **Theme Support**: Light and dark mode with system preference detection
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

### 🔒 Security & Data
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **Input Validation**: Comprehensive data validation with Zod
- **SQL Injection Protection**: Parameterized queries with better-sqlite3
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: HTTP security headers

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication
- **Vite** - Fast build tool and development server

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **TypeScript** - Type-safe server development
- **SQLite** - Lightweight, file-based database
- **better-sqlite3** - High-performance SQLite driver
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **Multer** - File upload handling
- **Zod** - Schema validation

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking
- **Vite** - Development server and build tool

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/06benste/schoolytest
   cd schoolmaster
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Build the application**
   ```bash
   # Build backend
   cd backend
   npm run build
   
   # Build frontend
   cd ../frontend
   npm run build
   ```

4. **Start the server**
   ```bash
   # From the root directory
   npm start
   # Or use the provided batch file on Windows
   start_server.bat
   ```

5. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Complete the initial setup wizard
   - Create your first admin user

## 🏗️ Project Structure

```
schoolmaster/
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── auth.ts         # Authentication middleware
│   │   ├── db.ts           # Database configuration
│   │   ├── index.ts        # Main server file
│   │   └── seed.ts         # Database seeding
│   ├── data/               # Database and uploads
│   │   ├── app.db          # SQLite database
│   │   └── uploads/        # File uploads
│   └── dist/               # Compiled JavaScript
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service functions
│   │   └── styles.css      # Global styles
│   └── dist/               # Built frontend
├── nginx/                  # Nginx configuration
└── docker/                 # Docker configuration
```

## 🎯 User Roles & Permissions

### Admin
- Full system access
- User management (create, edit, archive users)
- Course and curriculum management
- System settings and configuration
- Import/export functionality
- System health monitoring

### Teacher
- Create and edit lessons
- Create and edit assessments
- Manage assignments
- View and grade student work
- Access to assigned classes

### Student
- View assigned lessons and assessments
- Submit assignments
- Track personal progress
- Access to assigned courses

## 📋 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Archive user

### Lessons
- `GET /api/lessons` - Get all lessons
- `POST /api/lessons` - Create lesson
- `PUT /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson

### Assessments
- `GET /api/assessments` - Get all assessments
- `POST /api/assessments` - Create assessment
- `PUT /api/assessments/:id` - Update assessment
- `DELETE /api/assessments/:id` - Delete assessment

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Archive class

### Import/Export
- `GET /api/import-export/export` - Export system data
- `GET /api/import-export/export-zip` - Export complete backup
- `POST /api/import-export/import-zip` - Import backup
- `GET /api/import-export/stats` - Get system statistics

### System Status
- `GET /api/status/health` - Health check
- `GET /api/status/status` - Detailed system status

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_PATH=./data/app.db

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# File Uploads
UPLOADS_DIR=./data/uploads
MAX_FILE_SIZE=10485760

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Database Schema
The system uses SQLite with the following main tables:
- `users` - User accounts and profiles
- `classes` - Class information
- `lessons` - Lesson content and metadata
- `assessments` - Assessment questions and answers
- `courses` - Course definitions
- `topics` - Topic definitions
- `assignments` - Assignment configurations
- `attempts` - Student submission attempts
- `settings` - System configuration

## 🚀 Deployment

### Production Build
```bash
# Build both frontend and backend
cd backend && npm run build
cd ../frontend && npm run build

# Start production server
cd ../backend && npm start
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Nginx Configuration
The included nginx configuration provides:
- Static file serving
- API proxy
- Gzip compression
- Security headers

## 🧪 Development

### Running in Development Mode
```bash
# Backend development server
cd backend
npm run dev

# Frontend development server (in another terminal)
cd frontend
npm run dev
```

### Database Seeding
```bash
cd backend
npm run seed
```

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Comprehensive error handling

## 📊 System Monitoring

### Health Checks
- Database connectivity
- File system access
- Memory usage
- System uptime

### Logging
- Request logging
- Error tracking
- Performance monitoring

## 🔄 Backup & Restore

### Automatic Backups
- Complete system export (ZIP format)
- Includes all data and uploaded files
- Versioned backups with timestamps

### Manual Backup
1. Navigate to Admin → Import/Export
2. Click "Complete Backup (ZIP)"
3. Download the backup file

### Restore from Backup
1. Navigate to Admin → Import/Export
2. Click "Import Complete Backup"
3. Select your backup file
4. Choose import options
5. Confirm the restore

## 🆘 Troubleshooting

### Common Issues

**Database Connection Errors**
- Check if `data/app.db` exists
- Verify file permissions
- Ensure SQLite is properly installed

**File Upload Issues**
- Check `data/uploads` directory permissions
- Verify file size limits
- Check available disk space

**Authentication Problems**
- Verify JWT_SECRET is set
- Check token expiration
- Clear browser cache and cookies

**Build Errors**
- Ensure Node.js 18+ is installed
- Clear node_modules and reinstall
- Check TypeScript configuration

### Getting Help
1. Check the system status page (Admin → System Status)
2. Review server logs
3. Check browser console for errors
4. Verify environment configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- React team for the excellent framework
- Express.js for the robust backend framework
- SQLite for the lightweight database
- All contributors and users who provide feedback

---

**School Master** - Empowering education through technology
