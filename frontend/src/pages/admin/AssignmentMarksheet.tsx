import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import HelpButton from '../../components/HelpButton'

export default function AssignmentMarksheet(){
  const { id } = useParams<{ id: string }>()
  const [assignment, setAssignment] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData(){
      if (!id) {
        setError('Assignment ID not provided')
        setLoading(false)
        return
      }
      
      try {
        const res = await api.get(`/assignments/${id}/completion`)
        console.log('Assignment completion data:', res.data) // Debug log
        setAssignment(res.data.assignment)
        setStudents(res.data.students || [])
      } catch (err: any) {
        console.error('Error loading assignment data:', err) // Debug log
        setError(err?.response?.data?.error ?? 'Failed to load assignment data')
      }
      setLoading(false)
    }
    loadData()
  }, [id])

  async function resetStudentAttempts(studentId: string) {
    if (!id) return
    
    const studentName = students.find(s => s.id === studentId)?.firstName + ' ' + students.find(s => s.id === studentId)?.lastName
    if (!confirm(`Are you sure you want to reset all attempts for ${studentName}? This action cannot be undone.`)) {
      return
    }
    
    try {
      await api.delete(`/assignments/${id}/attempts/${studentId}`)
      alert('Student attempts reset successfully!')
      // Reload the data to reflect the changes
      const res = await api.get(`/assignments/${id}/completion`)
      setStudents(res.data.students || [])
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to reset student attempts')
    }
  }

  if (loading) return <div className="card">Loading...</div>
  if (error) return <div className="card" style={{ color: '#dc3545' }}>Error: {error}</div>
  if (!assignment) return <div className="card">Assignment not found</div>

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>{assignment.title}</h2>
        {assignment.lesson_title && <div className="muted">Lesson: {assignment.lesson_title}</div>}
        {assignment.assessment_title && <div className="muted">Assessment: {assignment.assessment_title}</div>}
        <div className="muted">
          Assigned by: {assignment.assigned_by_name} | 
          Due: {assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date'} |
          Max Attempts: {assignment.max_attempts || 'Unlimited'}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Student Progress</h3>
          <div style={{ display: 'flex', gap: 16, fontSize: '14px' }}>
            <span style={{ color: '#007acc' }}><strong>{students.length}</strong> Total</span>
            <span style={{ color: '#155724' }}><strong>{students.filter(s => s.status === 'completed').length}</strong> Completed</span>
            <span style={{ color: '#856404' }}><strong>{students.filter(s => s.status === 'in_progress').length}</strong> In Progress</span>
            <span style={{ color: '#6c757d' }}><strong>{students.filter(s => s.status === 'unattempted').length}</strong> Unattempted</span>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Status</th>
              <th>Score</th>
              <th>Last Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td><strong>{student.first_name} {student.last_name}</strong></td>
                <td>{student.class_name || '—'}</td>
                <td>
                  <span style={{ 
                    padding: '6px 12px', 
                    borderRadius: 6, 
                    fontSize: '0.9em',
                    fontWeight: '600',
                    backgroundColor: student.status === 'completed' ? '#d4edda' : 
                                   student.status === 'in_progress' ? '#fff3cd' : '#f8f9fa',
                    color: student.status === 'completed' ? '#155724' : 
                           student.status === 'in_progress' ? '#856404' : '#6c757d',
                    border: `1px solid ${student.status === 'completed' ? '#c3e6cb' : 
                                        student.status === 'in_progress' ? '#ffeaa7' : '#dee2e6'}`
                  }}>
                    {student.status === 'completed' ? '✅ Completed' : 
                     student.status === 'in_progress' ? '🔄 In Progress' : '⏸️ Unattempted'}
                  </span>
                </td>
                <td>
                  {student.latestScore !== undefined && student.latestScore !== null && student.maxScore ? (
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: '0.9em',
                      fontWeight: '600',
                      backgroundColor: '#e3f2fd',
                      color: '#000000',
                      border: '1px solid #bbdefb'
                    }}>
                      {student.latestScore} / {student.maxScore}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  {student.lastSubmitted 
                    ? new Date(student.lastSubmitted).toLocaleDateString() 
                    : 'Never'
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {student.attemptCount > 0 && (
                      <button 
                        onClick={() => window.open(`/assignments/${id}/review/${student.id}`, '_blank')}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#007acc', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}
                      >
                        Review
                      </button>
                    )}
                    {student.attemptCount > 0 && (
                      <button 
                        onClick={() => resetStudentAttempts(student.id)}
                        style={{ 
                          padding: '6px 12px', 
                          backgroundColor: '#dc3545', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <HelpButton 
        pageName="Student Progress" 
        helpContent={`<h4>Student Progress Tracking</h4>
        
<p><strong>Overview:</strong></p>
<ul>
<li>View all students assigned to this assignment</li>
<li>Track completion status and attempt counts</li>
<li>Monitor latest scores and submission dates</li>
</ul>

<p><strong>Status Indicators:</strong></p>
<ul>
<li><strong>In Progress:</strong> Student can still attempt the assignment</li>
<li><strong>Completed:</strong> Student has submitted at least one attempt</li>
<li><strong>Max Attempts:</strong> Student has reached the maximum number of attempts</li>
</ul>

<p><strong>Progress Information:</strong></p>
<ul>
<li><strong>Attempts:</strong> Shows current attempts vs maximum allowed</li>
<li><strong>Latest Score:</strong> Most recent score achieved</li>
<li><strong>Last Submitted:</strong> When the student last submitted</li>
<li><strong>Class:</strong> Shows which class the student was assigned through</li>
</ul>

<p><strong>Actions:</strong></p>
<ul>
<li><strong>Reset Attempts:</strong> Clear all attempts for a student (use with caution)</li>
<li><strong>View Details:</strong> See detailed attempt history</li>
</ul>

<p><strong>Note:</strong> Students in multiple classes will only appear once per assignment, showing the specific class they were assigned through.</p>`}
      />
    </div>
  )
}
