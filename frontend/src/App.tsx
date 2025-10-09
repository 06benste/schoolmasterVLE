import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { SchoolProvider, useSchool } from './contexts/SchoolContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LessonBuilder from './pages/admin/LessonBuilder'
import NewLesson from './pages/admin/NewLesson'
import Users from './pages/admin/Users'
import Assignments from './pages/admin/Assignments'
import AssessmentBuilder from './pages/admin/AssessmentBuilder'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import PasswordChangeModal from './components/PasswordChangeModal'
import Curriculum from './pages/admin/Curriculum'
import CourseManagement from './pages/admin/CourseManagement'
import Marksheet from './pages/classes/Marksheet'
import AssignmentMarksheet from './pages/admin/AssignmentMarksheet'
import ResponseReview from './pages/admin/ResponseReview'
import CourseAssignmentManager from './pages/admin/CourseAssignmentManager'
import Classes from './pages/classes/Classes'
import LessonPlayer from './pages/student/LessonPlayer'
import AssessmentPlayer from './pages/student/AssessmentPlayer'
import MyAssignments from './pages/student/MyAssignments'
import MyCourses from './pages/student/MyCourses'
import LessonView from './pages/lessons/View'
import ImportExportPage from './pages/admin/ImportExport'
import ArchivedUsers from './pages/admin/ArchivedUsers'
import ArchivedClasses from './pages/admin/ArchivedClasses'
import SystemStatus from './pages/admin/SystemStatus'
import Profile from './pages/Profile'
import Setup from './pages/Setup'
import TestSetup from './pages/TestSetup'
import SetupGuard from './components/SetupGuard'
import CompleteSetupWizard from './components/CompleteSetupWizard'
import QuickSearch from './components/QuickSearch'
import { useDocumentTitle } from './hooks/useDocumentTitle'

export default function App(){
  console.log('🚀 App component rendering...')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    console.log('🔍 App useEffect running...')
    const storedUser = localStorage.getItem('user')
    console.log('👤 Stored user:', storedUser)
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      if (userData.mustChangePassword) {
        setShowPasswordChange(true)
      }
    }
  }, [])

  function handlePasswordChangeSuccess() {
    setShowPasswordChange(false)
    // Update user data to remove mustChangePassword flag
    const updatedUser = { ...user, mustChangePassword: false }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  console.log('🎨 App render - ThemeProvider wrapper')
  return (
    <ThemeProvider>
      <SchoolProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </SchoolProvider>
    </ThemeProvider>
  )
}

function AppContent() {
  console.log('📱 AppContent component rendering...')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const location = useLocation()
  
  console.log('🏫 Getting school settings...')
  const { settings } = useSchool()
  console.log('✅ School settings loaded:', settings)

  console.log('📄 Setting document title:', settings.schoolName)
  useDocumentTitle(settings.schoolName)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      if (userData.mustChangePassword) {
        setShowPasswordChange(true)
      }
    }
  }, [])

  // Listen for storage changes (when user logs in from another tab/window)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        setUser(userData)
        if (userData.mustChangePassword) {
          setShowPasswordChange(true)
        }
      } else {
        setUser(null)
        setShowPasswordChange(false)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Also check for user changes on route changes (for same-tab login)
  useEffect(() => {
    const checkUser = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        setUser(userData)
        if (userData.mustChangePassword) {
          setShowPasswordChange(true)
        }
      } else {
        setUser(null)
        setShowPasswordChange(false)
      }
    }
    
    // Check user state when location changes
    checkUser()
  }, [location.pathname])

  function handlePasswordChangeSuccess() {
    setShowPasswordChange(false)
    // Update user data to remove mustChangePassword flag
    const updatedUser = { ...user, mustChangePassword: false }
    setUser(updatedUser)
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setNotice('✅ Your password was changed successfully.')
    setTimeout(() => setNotice(null), 4000)
  }

  console.log('🛡️ AppContent render - SetupGuard wrapper')
  
  return (
    <SetupGuard>
        <div className="app-layout">
          {user && <Navbar />}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', flex: 1 }}>
          <main className={`main-content ${!user ? 'no-sidebar' : ''}`} style={{ flex: 1 }}>
            {notice && (
              <div style={{
                margin: '12px',
                padding: '12px 16px',
                backgroundColor: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
                borderRadius: '6px',
                fontWeight: '500'
              }}>
                {notice}
              </div>
            )}
          <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/setup" element={<CompleteSetupWizard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute allow={['admin','teacher','student']}><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/lessons" element={<ProtectedRoute allow={['admin','teacher']}><LessonBuilder /></ProtectedRoute>} />
          <Route path="/admin/lessons/new" element={<ProtectedRoute allow={['admin','teacher']}><NewLesson /></ProtectedRoute>} />
          <Route path="/lessons/:id" element={<ProtectedRoute allow={['admin','teacher','student']}><LessonView /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allow={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/admin/assignments" element={<ProtectedRoute allow={['admin','teacher']}><Assignments /></ProtectedRoute>} />
          <Route path="/admin/assessments" element={<ProtectedRoute allow={['admin']}><AssessmentBuilder /></ProtectedRoute>} />
          <Route path="/admin/curriculum" element={<ProtectedRoute allow={['admin']}><Curriculum /></ProtectedRoute>} />
          <Route path="/admin/courses" element={<ProtectedRoute allow={['admin']}><CourseManagement /></ProtectedRoute>} />
          <Route path="/admin/course-assignments" element={<ProtectedRoute allow={['admin','teacher']}><CourseAssignmentManager /></ProtectedRoute>} />
          <Route path="/admin/import-export" element={<ProtectedRoute allow={['admin']}><ImportExportPage /></ProtectedRoute>} />
          <Route path="/admin/status" element={<ProtectedRoute allow={['admin']}><SystemStatus /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute allow={['admin','teacher','student']}><Profile /></ProtectedRoute>} />
          <Route path="/admin/users/archived" element={<ProtectedRoute allow={['admin']}><ArchivedUsers /></ProtectedRoute>} />
          <Route path="/admin/classes/archived" element={<ProtectedRoute allow={['admin']}><ArchivedClasses /></ProtectedRoute>} />
          <Route path="/classes/:id/marksheet" element={<ProtectedRoute allow={['admin','teacher']}><Marksheet /></ProtectedRoute>} />
          <Route path="/assignments/:id/marksheet" element={<ProtectedRoute allow={['admin','teacher']}><AssignmentMarksheet /></ProtectedRoute>} />
          <Route path="/assignments/:assignmentId/review/:studentId" element={<ProtectedRoute allow={['admin','teacher']}><ResponseReview /></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute allow={['admin','teacher']}><Classes /></ProtectedRoute>} />
          <Route path="/student/lesson" element={<ProtectedRoute allow={['student']}><LessonPlayer /></ProtectedRoute>} />
          <Route path="/student/assessment" element={<ProtectedRoute allow={['student']}><AssessmentPlayer /></ProtectedRoute>} />
          <Route path="/student/assignments" element={<ProtectedRoute allow={['student']}><MyAssignments /></ProtectedRoute>} />
          <Route path="/student/courses" element={<ProtectedRoute allow={['student']}><MyCourses /></ProtectedRoute>} />
          </Routes>
          </main>
          
          <PasswordChangeModal 
            isOpen={showPasswordChange}
            onClose={() => setShowPasswordChange(false)}
            onSuccess={handlePasswordChangeSuccess}
            forced={user?.mustChangePassword}
          />
          {user && <QuickSearch />}
          
          {/* Footer */}
          <footer style={{
            marginTop: 'auto',
            padding: '20px',
            textAlign: 'center',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--panel)',
            color: 'var(--muted)',
            fontSize: '14px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <a 
                href="https://buymeacoffee.com/06benstecode" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#FFDD00',
                  color: '#000000',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  transition: 'transform 0.2s',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ☕ Buy me a coffee
              </a>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Made with ❤️ for UTC South Durham
            </div>
          </footer>
          </div>
          </div>
    </SetupGuard>
  )
}



