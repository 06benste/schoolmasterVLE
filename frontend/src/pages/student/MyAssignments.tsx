import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Link, useLocation } from 'react-router-dom'

export default function MyAssignments(){
  const [list, setList] = useState<any[]>([])
  const location = useLocation()

  const loadAssignments = async () => {
    const res = await api.get('/assignments/my')
    setList(res.data)
  }

  useEffect(() => {
    loadAssignments()
  }, [])

  // Refresh assignments when component becomes visible (user returns from lesson)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh assignments
        loadAssignments()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Refresh when location changes (user navigates back to this page)
  useEffect(() => {
    loadAssignments()
  }, [location.pathname])

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>My Assignments</h3>
          <button 
            onClick={loadAssignments}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🔄 Refresh
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id}>
                <td>
                  <strong>{a.title}</strong>
                  {a.lesson_title && <div className="muted" style={{ fontSize: '0.9em' }}>Lesson: {a.lesson_title}</div>}
                  {a.assessment_title && <div className="muted" style={{ fontSize: '0.9em' }}>Assessment: {a.assessment_title}</div>}
                </td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    fontWeight: '600',
                    backgroundColor: a.type === 'lesson' ? '#e3f2fd' : '#f3e5f5',
                    color: a.type === 'lesson' ? '#1976d2' : '#7b1fa2'
                  }}>
                    {a.type === 'lesson' ? '📚 Lesson' : '📝 Assessment'}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.9em',
                    fontWeight: '600',
                    backgroundColor: a.status === 'completed' ? '#d4edda' : 
                                   a.status === 'in_progress' ? '#fff3cd' : '#f8f9fa',
                    color: a.status === 'completed' ? '#155724' : 
                           a.status === 'in_progress' ? '#856404' : '#6c757d',
                    border: `1px solid ${a.status === 'completed' ? '#c3e6cb' : 
                                        a.status === 'in_progress' ? '#ffeaa7' : '#dee2e6'}`
                  }}>
                    {a.status === 'completed' ? '✅ Completed' : 
                     a.status === 'in_progress' ? '🔄 In Progress' : '⏸️ Unattempted'}
                  </span>
                </td>
                <td className="muted">
                  {a.due_at ? new Date(a.due_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {a.type==='lesson' && (
                      <Link 
                        to={`/student/lesson?lessonId=${a.ref_id}&assignmentId=${a.id}`}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: a.isCompleted ? '#28a745' : '#007bff',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        {a.isCompleted ? 'Review' : 'Open'}
                      </Link>
                    )}
                    {a.type==='assessment' && (
                      <Link 
                        to={`/student/assessment?assessmentId=${a.ref_id}&assignmentId=${a.id}`}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: a.isCompleted ? '#28a745' : '#007bff',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        {a.isCompleted ? 'Review' : 'Open'}
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {list.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
          <h3>No Assignments Yet</h3>
          <p className="muted">Your teacher hasn't assigned any lessons or assessments yet.</p>
        </div>
      )}
    </div>
  )
}


