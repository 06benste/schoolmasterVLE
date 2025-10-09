# School Master VLE

THIS SOFTWARE IS IN EARLY DEVELOPMENT. DO NOT RELY ON IT FOR DEPLOYMENT

A full-stack learning management system for educational institutions. Built with React, TypeScript, Express, and SQLite.

## Features

### Content Management
- Visual lesson builder with drag-and-drop interface
- Assessment builder with multiple question types
- Course and topic organization
- Media support (images, videos, documents)
- Autosave functionality

### User Management
- Role-based access control (Admin, Teacher, Student)
- CSV import/export for bulk user management
- Password management with forced password change
- User archiving

### Assignments & Grading
- Flexible assignment system
- Progress tracking
- Automated grading for objective questions
- Manual review for subjective answers
- Class marksheets

### System Features
- Global search (Ctrl+K)
- Complete backup and restore
- Light and dark themes
- Responsive design

### Security
- JWT authentication
- bcrypt password hashing
- Input validation
- SQL injection protection
- CORS protection
- Security headers

## Technology Stack

**Frontend:** React 18, TypeScript, React Router, Vite  
**Backend:** Node.js, Express, TypeScript, SQLite  
**Authentication:** JWT, bcryptjs  
**Database:** SQLite with better-sqlite3

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

1. Clone the repository:
```bash
git clone https://github.com/06benste/schoolmasterVLE
cd schoolmasterVLE
```

2. Install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Build the application:
```bash
# Backend
cd backend
npm run build

# Frontend
cd ../frontend
npm run build
```

4. Start the server:
```bash
# From the root directory
npm start
```

5. Access at `http://localhost:3000` and complete the setup wizard

## Deployment to Digital Ocean App Platform

### Prerequisites
- Digital Ocean account
- GitHub account with repository access

### Deployment Steps

1. Log in to your Digital Ocean account and navigate to the App Platform

2. Click "Create App" and select "GitHub" as your source

3. Authorize Digital Ocean to access your GitHub account and select the `schoolmasterVLE` repository

4. Configure your app:
   - **Name:** schoolmaster-vle (or your preferred name)
   - **Branch:** main
   - **Source Directory:** /

5. Configure the build settings:
   - **Build Command:**
   ```bash
   cd backend && npm install && npm run build && cd ../frontend && npm install && npm run build
   ```
   
   - **Run Command:**
   ```bash
   cd backend && npm start
   ```

6. Set environment variables in the App Platform dashboard:
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=your-secure-random-secret-key-here
   JWT_EXPIRES_IN=7d
   DATABASE_PATH=./data/app.db
   UPLOADS_DIR=./data/uploads
   ```

7. Configure the HTTP port to 3000

8. Add a persistent volume for data storage:
   - Mount path: `/workspace/backend/data`
   - Size: 5GB (or as needed)

9. Review and create the app

10. Once deployed, access your app URL and complete the initial setup wizard

### Important Notes

- The SQLite database and uploaded files are stored in the persistent volume
- Make sure to set a strong JWT_SECRET value
- The first user created through the setup wizard will be the admin
- Regular backups can be performed through the admin panel (Import/Export section)

### Updating the App

To update your deployed app:
1. Push changes to your GitHub repository
2. Digital Ocean will automatically detect changes and redeploy
3. Or manually trigger a deployment from the Digital Ocean dashboard

## User Roles

**Admin:**
- Full system access
- User and course management
- System configuration
- Import/export and backups

**Teacher:**
- Create and edit lessons and assessments
- Manage assignments
- Grade student work
- Access assigned classes

**Student:**
- View assigned content
- Submit assignments
- Track progress

## Configuration

For local development, create a `.env` file in the backend directory:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/app.db
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
UPLOADS_DIR=./data/uploads
```

## Database

The system uses SQLite with tables for users, classes, lessons, assessments, courses, topics, assignments, attempts, and settings.

## Development

Run the development servers:

```bash
# Backend (port 3000)
cd backend
npm run dev

# Frontend (port 5173)
cd frontend
npm run dev
```

## Backup & Restore

Use the admin panel to backup and restore your data:
1. Log in as admin
2. Navigate to Admin > Import/Export
3. Use "Complete Backup (ZIP)" to download all data
4. Use "Import Complete Backup" to restore from a backup file

## Troubleshooting

**Database errors:** Check that `backend/data/app.db` exists and has proper permissions

**File upload issues:** Verify `backend/data/uploads` directory exists and is writable

**Authentication issues:** Ensure JWT_SECRET is set in environment variables

**Build errors:** Clear `node_modules` and reinstall dependencies

## License

MIT License

## Repository

https://github.com/06benste/schoolmasterVLE
