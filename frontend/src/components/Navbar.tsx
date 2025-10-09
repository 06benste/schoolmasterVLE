import { Link, useNavigate, useLocation } from 'react-router-dom'
import logoImage from '../assets/logo.jpg'
import ThemeToggle from './ThemeToggle'
import { useSchool } from '../contexts/SchoolContext'

export default function Navbar(){
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useSchool()
  
  function logout(){
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  
  // Don't show navbar on login page when user is not logged in
  if (!user) {
    return null
  }
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/dashboard" className="sidebar-brand">
          <img 
            src={settings.schoolLogo ? `/uploads/${settings.schoolLogo}` : logoImage} 
            alt={`${settings.schoolName} Logo`} 
            className="logo" 
            style={{ height: 32, width: 32 }} 
          />
          <span>{settings.schoolName}</span>
        </Link>
      </div>
      
      <nav className="sidebar-nav">
        {user?.role==='admin' && (
          <>
            <Link to="/admin/courses" className={`sidebar-link ${location.pathname === '/admin/courses' ? 'active' : ''}`}>
              <span>🎯</span> Courses & Topics
            </Link>
            <Link to="/admin/lessons" className={`sidebar-link ${location.pathname.startsWith('/admin/lessons') ? 'active' : ''}`}>
              <span>📚</span> Lessons
            </Link>
            <Link to="/admin/assessments" className={`sidebar-link ${location.pathname === '/admin/assessments' ? 'active' : ''}`}>
              <span>📝</span> Assessments
            </Link>
            
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '12px 0' }}></div>
            
            <Link to="/admin/assignments" className={`sidebar-link ${location.pathname === '/admin/assignments' ? 'active' : ''}`}>
              <span>📋</span> Create & Manage Assignments
            </Link>
            
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '12px 0' }}></div>
            
            <Link to="/admin/users" className={`sidebar-link ${location.pathname === '/admin/users' ? 'active' : ''}`}>
              <span>👥</span> Users
            </Link>
            <Link to="/classes" className={`sidebar-link ${location.pathname.startsWith('/classes') ? 'active' : ''}`}>
              <span>🏫</span> Classes
            </Link>
            <Link to="/admin/course-assignments" className={`sidebar-link ${location.pathname === '/admin/course-assignments' ? 'active' : ''}`}>
              <span>🔗</span> Grant Course and Topic Access
            </Link>
            <Link to="/admin/import-export" className={`sidebar-link ${location.pathname === '/admin/import-export' ? 'active' : ''}`}>
              <span>📁</span> Import/Export
            </Link>
            <Link to="/admin/status" className={`sidebar-link ${location.pathname === '/admin/status' ? 'active' : ''}`}>
              <span>🔧</span> System Status
            </Link>
          </>
        )}
        {user?.role==='teacher' && (
          <>
            <Link to="/admin/lessons" className={`sidebar-link ${location.pathname.startsWith('/admin/lessons') ? 'active' : ''}`}>
              <span>📚</span> Lessons
            </Link>
            <Link to="/admin/course-assignments" className={`sidebar-link ${location.pathname === '/admin/course-assignments' ? 'active' : ''}`}>
              <span>🔗</span> Grant Course and Topic Access
            </Link>
            <Link to="/admin/assignments" className={`sidebar-link ${location.pathname === '/admin/assignments' ? 'active' : ''}`}>
              <span>📋</span> Create & Manage Assignments
            </Link>
          </>
        )}
        {user?.role==='student' && (
          <>
            <Link to="/student/assignments" className={`sidebar-link ${location.pathname === '/student/assignments' ? 'active' : ''}`}>
              <span>📋</span> My Assignments
            </Link>
            <Link to="/student/courses" className={`sidebar-link ${location.pathname === '/student/courses' ? 'active' : ''}`}>
              <span>📚</span> My Courses
            </Link>
          </>
        )}
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-name">{user.firstName || user.email?.split('@')[0]}</span>
          <span className="user-role">({user.role})</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <ThemeToggle />
          <Link to="/profile" className="sidebar-link" style={{ flex: 1, textAlign: 'center', padding: '8px 12px' }}>
            <span>👤</span> Profile
          </Link>
          <button className="logout-btn" onClick={logout} style={{ flex: 1 }}>Logout</button>
        </div>
      </div>
    </aside>
  )
}


