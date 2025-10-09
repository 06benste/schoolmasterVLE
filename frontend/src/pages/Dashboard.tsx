import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import logoImage from '../assets/logo.jpg'
import HelpButton from '../components/HelpButton'
import { useSchool } from '../contexts/SchoolContext'

type User = { id: string; role: 'admin'|'teacher'|'student'; firstName?: string; lastName?: string; email: string }

export default function Dashboard(){
  const { settings } = useSchool()
  const [user, setUser] = useState<User | null>(null)
  const [lessons, setLessons] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [assignedContent, setAssignedContent] = useState<{
    courses: any[];
    topics: any[];
    lessons: any[];
  }>({ courses: [], topics: [], lessons: [] })
  const [assignments, setAssignments] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalLessons: 0,
    totalClasses: 0,
    totalCourses: 0,
    totalUsers: 0,
    unassignedLessons: 0
  })

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
  }, [])

  useEffect(() => {
    async function load(){
      try{
        const promises = []
        
        if (user?.role === 'student'){
          // Load assigned content for students
          promises.push(api.get('/course-assignments/my-content'))
          promises.push(api.get('/assignments/my'))
        } else {
          promises.push(api.get('/lessons'))
          promises.push(api.get('/classes/placeholder-list'))
          if (user?.role === 'admin') {
            promises.push(api.get('/curriculum/courses'))
            promises.push(api.get('/users'))
          }
        }
        
        const results = await Promise.allSettled(promises)
        
        if (user?.role === 'student'){
          if (results[0]?.status === 'fulfilled') setAssignedContent(results[0].value.data)
          if (results[1]?.status === 'fulfilled') setAssignments(results[1].value.data)
        } else {
          const newLessons = results[0]?.status === 'fulfilled' ? results[0].value.data : lessons
          const newClasses = results[1]?.status === 'fulfilled' ? results[1].value.data : classes
          const newCourses = results[2]?.status === 'fulfilled' ? results[2].value.data : courses
          const newUsers = results[3]?.status === 'fulfilled' ? results[3].value.data : users
          
          // Update state
          if (results[0]?.status === 'fulfilled') setLessons(newLessons)
          if (results[1]?.status === 'fulfilled') setClasses(newClasses)
          if (results[2]?.status === 'fulfilled') setCourses(newCourses)
          if (results[3]?.status === 'fulfilled') setUsers(newUsers)
          
          // Calculate stats with the new data
          const unassignedLessons = newLessons.filter((l: any) => !l.courseTitle).length
          setStats({
            totalLessons: newLessons.length,
            totalClasses: newClasses.length,
            totalCourses: newCourses.length,
            totalUsers: newUsers.length,
            unassignedLessons
          })
        }
      }catch{}
    }
    load()
  }, [user]) // Only depend on user, not on the data states

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null
    
    try {
      const today = new Date()
      const due = new Date(dueDate)
      
      // Check if date is valid
      if (isNaN(due.getTime())) {
        return null
      }
      
      // Set time to start of day for accurate day calculation
      today.setHours(0, 0, 0, 0)
      due.setHours(0, 0, 0, 0)
      
      const diffTime = due.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays
    } catch (error) {
      console.error('Error calculating days until due:', error)
      return null
    }
  }

  const getDueDateStatus = (dueDate: string) => {
    const days = getDaysUntilDue(dueDate)
    
    // Handle invalid or missing dates
    if (days === null) {
      return { text: 'No due date', color: '#6c757d', bg: '#f8f9fa' }
    }
    
    if (days < 0) return { text: 'Overdue', color: '#dc3545', bg: '#f8d7da' }
    if (days === 0) return { text: 'Due today', color: '#856404', bg: '#fff3cd' }
    if (days === 1) return { text: 'Due tomorrow', color: '#856404', bg: '#fff3cd' }
    if (days <= 3) return { text: `${days} days left`, color: '#856404', bg: '#fff3cd' }
    return { text: `${days} days left`, color: '#155724', bg: '#d4edda' }
  }

  return (
    <div className="grid cols-2" style={{ gap: 16 }}>
      {/* Welcome & Stats Combined */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <img 
            src={settings.schoolLogo ? `/uploads/${settings.schoolLogo}` : logoImage} 
            alt={`${settings.schoolName} Logo`} 
            className="logo-large" 
            style={{ height: 40, width: 40 }} 
          />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4em' }}>{getGreeting()}, {user?.firstName || user?.email?.split('@')[0] || 'User'}!</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.9em' }}>Welcome to your {settings.schoolName} dashboard.</p>
          </div>
        </div>
        
        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: 'var(--border)', borderRadius: 6, minWidth: '120px' }}>
              <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.totalLessons}</div>
              <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>Lessons</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: 'var(--border)', borderRadius: 6, minWidth: '120px' }}>
              <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: 'var(--accent-2)' }}>{stats.totalClasses}</div>
              <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>Classes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: 'var(--border)', borderRadius: 6, minWidth: '120px' }}>
              <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#ffc107' }}>{stats.totalCourses}</div>
              <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>Courses</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: 'var(--border)', borderRadius: 6, minWidth: '120px' }}>
              <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#6f42c1' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>Users</div>
            </div>
          </div>
        )}

      </div>


      {/* Recent Content - Combined Lessons & Classes */}
      {user?.role !== 'student' && (
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="grid cols-2" style={{ gap: 16 }}>
            {/* Recent Lessons */}
            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>Recent Lessons</h3>
              {lessons.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.9em' }}>No lessons created yet.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {lessons.slice(0, 3).map((lesson) => (
                    <div key={lesson.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <Link to={`/lessons/${lesson.id}`} style={{ textDecoration: 'none', fontSize: '0.9em' }}>
                        <strong>{lesson.title}</strong>
                      </Link>
                      {lesson.courseTitle && (
                        <div className="muted" style={{ fontSize: '0.8em' }}>
                          📚 {lesson.courseTitle}
                        </div>
                      )}
                      {!lesson.courseTitle && (
                        <div style={{ fontSize: '0.8em', color: '#f87171' }}>
                          ⚠️ Unassigned
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {lessons.length > 3 && (
                <div style={{ marginTop: 8 }}>
                  <Link to="/admin/lessons" style={{ fontSize: '0.9em' }}>View all lessons</Link>
                </div>
              )}
            </div>

            {/* Classes */}
            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>Classes</h3>
              {classes.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.9em' }}>No classes created yet.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {classes.slice(0, 3).map((cls) => (
                    <div key={cls.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <Link to={`/classes/${cls.id}/marksheet`} style={{ textDecoration: 'none', fontSize: '0.9em' }}>
                        <strong>{cls.name}</strong>
                      </Link>
                      <div className="muted" style={{ fontSize: '0.8em' }}>
                        Teacher: {users.find(u => u.id === cls.teacherId)?.firstName || 'Unknown'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {classes.length > 3 && (
                <div style={{ marginTop: 8 }}>
                  <Link to="/classes" style={{ fontSize: '0.9em' }}>View all classes</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current Assignments for Students */}
      {user?.role === 'student' && assignments.length > 0 && (
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.2em' }}>📝 Current Assignments</h3>
            <Link to="/student/assignments" style={{ 
              fontSize: '0.9em', 
              color: 'var(--accent)', 
              textDecoration: 'none',
              fontWeight: '500'
            }}>
              View All →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {assignments.slice(0, 5).map((assignment) => {
              const dueStatus = getDueDateStatus(assignment.due_date)
              console.log('Assignment due date:', assignment.due_date, 'Status:', dueStatus)
              return (
                <div 
                  key={assignment.id} 
                  style={{ 
                    padding: '16px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--panel)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1em', marginBottom: '4px' }}>
                      {assignment.title}
                    </div>
                    {assignment.lesson_title && (
                      <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginBottom: '4px' }}>
                        📖 Lesson: {assignment.lesson_title}
                      </div>
                    )}
                    {assignment.assessment_title && (
                      <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginBottom: '4px' }}>
                        📊 Assessment: {assignment.assessment_title}
                      </div>
                    )}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      marginTop: '8px'
                    }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        backgroundColor: assignment.status === 'completed' ? '#d4edda' : 
                                       assignment.status === 'in_progress' ? '#fff3cd' : '#f8f9fa',
                        color: assignment.status === 'completed' ? '#155724' : 
                               assignment.status === 'in_progress' ? '#856404' : '#6c757d',
                        border: `1px solid ${assignment.status === 'completed' ? '#c3e6cb' : 
                                        assignment.status === 'in_progress' ? '#ffeaa7' : '#dee2e6'}`
                      }}>
                        {assignment.status === 'completed' ? '✅ Completed' : 
                         assignment.status === 'in_progress' ? '🔄 In Progress' : '⏸️ Unattempted'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    {assignment.due_date && (
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.9em',
                        fontWeight: '600',
                        backgroundColor: dueStatus.bg,
                        color: dueStatus.color,
                        border: `1px solid ${dueStatus.color}20`
                      }}>
                        {dueStatus.text}
                      </div>
                    )}
                    <Link 
                      to={`/student/lesson?lessonId=${assignment.ref_id}&assignmentId=${assignment.id}`}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9em',
                        fontWeight: '500',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent-dark)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--accent)'
                      }}
                    >
                      {assignment.status === 'completed' ? 'Review' : 'Start'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Student Content */}
      {user?.role === 'student' && (
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="grid cols-3" style={{ gap: 16 }}>
            {/* Assigned Courses */}
            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>My Courses</h3>
              {assignedContent.courses.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.9em' }}>No courses assigned yet.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {assignedContent.courses.slice(0, 5).map((course) => (
                    <div key={course.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{course.title}</div>
                      {course.description && (
                        <div className="muted" style={{ fontSize: '0.8em' }}>
                          {course.description.length > 50 ? course.description.substring(0, 50) + '...' : course.description}
                        </div>
                      )}
                      <div className="muted" style={{ fontSize: '0.7em' }}>
                        Assigned: {new Date(course.assigned_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Topics */}
            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>My Topics</h3>
              {assignedContent.topics.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.9em' }}>No topics assigned yet.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {assignedContent.topics.slice(0, 5).map((topic) => (
                    <div key={topic.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{topic.title}</div>
                      {topic.course_title && (
                        <div className="muted" style={{ fontSize: '0.8em' }}>
                          📚 {topic.course_title}
                        </div>
                      )}
                      <div className="muted" style={{ fontSize: '0.7em' }}>
                        Assigned: {new Date(topic.assigned_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Lessons */}
            <div>
              <h3 style={{ marginBottom: 12, fontSize: '1.1em' }}>My Lessons</h3>
              {assignedContent.lessons.length === 0 ? (
                <div className="muted" style={{ fontSize: '0.9em' }}>No lessons available yet.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {assignedContent.lessons.slice(0, 5).map((lesson) => (
                    <div key={lesson.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <Link to={`/lessons/${lesson.id}`} style={{ textDecoration: 'none', fontSize: '0.9em', fontWeight: 'bold' }}>
                        {lesson.title}
                      </Link>
                      {lesson.course_title && (
                        <div className="muted" style={{ fontSize: '0.8em' }}>
                          📚 {lesson.course_title}
                        </div>
                      )}
                      {lesson.topic_title && (
                        <div className="muted" style={{ fontSize: '0.8em' }}>
                          📖 {lesson.topic_title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}
      
      <HelpButton 
        pageName="Dashboard" 
        helpContent={`<h4>Welcome to ${settings.schoolName} Dashboard</h4>
        
<p><strong>For Students:</strong></p>
<ul>
<li><strong>My Courses:</strong> View all courses assigned to you</li>
<li><strong>My Lessons:</strong> Access lessons within your assigned courses</li>
<li><strong>My Assignments:</strong> Complete and track your assignments</li>
</ul>

<p><strong>For Teachers & Admins:</strong></p>
<ul>
<li><strong>Quick Stats:</strong> Overview of system activity</li>
<li><strong>Recent Lessons:</strong> Latest lessons created</li>
<li><strong>System Management:</strong> Access to admin functions</li>
</ul>

<p><strong>Navigation:</strong> Use the sidebar menu to access different sections of the system.</p>`}
      />
    </div>
  )
}



