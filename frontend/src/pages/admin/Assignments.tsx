import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'

type Target = { type: 'class'|'student'; id: string }

export default function Assignments(){
  const [lessons, setLessons] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [refId, setRefId] = useState('')
  const [assignmentType, setAssignmentType] = useState<'lesson' | 'assessment'>('lesson')
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState<number | ''>('')
  const [targets, setTargets] = useState<Target[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [classSearchTerm, setClassSearchTerm] = useState('')
  const [studentSearchTerm, setStudentSearchTerm] = useState('')

  const addTarget = (t: Target) => setTargets(prev => prev.some(x=>x.type===t.type && x.id===t.id) ? prev : [...prev, t])
  const removeTarget = (t: Target) => setTargets(prev => prev.filter(x=> !(x.type===t.type && x.id===t.id)))

  // Filter classes based on search term
  const filteredClasses = useMemo(() => {
    if (!classSearchTerm.trim()) return classes;
    const search = classSearchTerm.toLowerCase();
    return classes.filter((c: any) => c.name?.toLowerCase().includes(search));
  }, [classes, classSearchTerm]);

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return students;
    const search = studentSearchTerm.toLowerCase();
    return students.filter((s: any) => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      return (
        s.username?.toLowerCase().includes(search) ||
        s.firstName?.toLowerCase().includes(search) ||
        s.lastName?.toLowerCase().includes(search) ||
        s.email?.toLowerCase().includes(search) ||
        fullName.includes(search)
      );
    });
  }, [students, studentSearchTerm]);

  async function load(){
    const [l, as, c, u, a] = await Promise.all([
      api.get('/lessons'),
      api.get('/assessments'),
      api.get('/classes/placeholder-list'),
      api.get('/users'),
      api.get('/assignments')
    ])
    setLessons(l.data); setAssessments(as.data); setClasses(c.data); setStudents(u.data.filter((x:any)=>x.role==='student')); setAssignments(a.data)
    if (!refId && l.data[0]) setRefId(l.data[0].id)
  }


  async function deleteAssignment(id: string){
    if (!confirm('Are you sure you want to delete this assignment? This will also delete all student attempts and progress data.')) return
    setMessage(null)
    try{
      await api.delete(`/assignments/${id}`)
      setMessage('Assignment deleted successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  useEffect(()=>{ load() },[])

  async function create(){
    setMessage(null)
    try{
      await api.post('/assignments', { 
        title, 
        type: assignmentType, 
        refId, 
        dueAt: dueAt || undefined, 
        targets,
        maxAttempts: maxAttempts || undefined
      })
      setTitle(''); setDueAt(''); setMaxAttempts(''); setTargets([])
      setMessage('Assignment created')
      setShowCreateDialog(false)
      await load()
    }catch(err: any){ setMessage(err?.response?.data?.error ?? 'Failed') }
  }

  function openCreateDialog(){
    setShowCreateDialog(true)
    setTitle(''); setRefId(''); setDueAt(''); setMaxAttempts(''); setTargets([]); setAssignmentType('lesson')
    setClassSearchTerm(''); setStudentSearchTerm('')
    setMessage(null)
  }

  function closeCreateDialog(){
    setShowCreateDialog(false)
    setMessage(null)
  }

  async function updateAssignment(){
    if (!editingAssignment) return
    setMessage(null)
    try{
      await api.put(`/assignments/${editingAssignment.id}`, { 
        title, 
        dueAt: dueAt || undefined, 
        maxAttempts: maxAttempts || undefined
      })
      setMessage('Assignment updated successfully')
      setShowEditDialog(false)
      setEditingAssignment(null)
      await load()
    }catch(err: any){ 
      setMessage(err?.response?.data?.error ?? 'Update failed') 
    }
  }

  function openEditDialog(assignment: any){
    setEditingAssignment(assignment)
    setTitle(assignment.title)
    setDueAt(assignment.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : '')
    setMaxAttempts(assignment.max_attempts || '')
    setShowEditDialog(true)
    setMessage(null)
  }

  function closeEditDialog(){
    setShowEditDialog(false)
    setEditingAssignment(null)
    setMessage(null)
  }

  // Reset refId when type changes
  function handleTypeChange(newType: 'lesson' | 'assessment'){
    setAssignmentType(newType)
    setRefId('')
    // Set default selection
    if (newType === 'lesson' && lessons[0]) {
      setRefId(lessons[0].id)
    } else if (newType === 'assessment' && assessments[0]) {
      setRefId(assessments[0].id)
    }
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Create & Manage Assignments</h3>
          <button onClick={openCreateDialog} className="button">+ Create New Assignment</button>
        </div>
      </div>

      <div className="card">
        <h3>Current Assignments</h3>
        {assignments.length === 0 ? (
          <div className="muted">No assignments created yet.</div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {assignments.map(assignment => (
              <div key={assignment.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{assignment.title}</strong>
                    {assignment.lesson_title && <div className="muted">Lesson: {assignment.lesson_title}</div>}
                    {assignment.assessment_title && <div className="muted">Assessment: {assignment.assessment_title}</div>}
                    <div className="muted" style={{ fontSize: '0.9em' }}>
                      Assigned by: {assignment.assigned_by_name} | 
                      Due: {assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date'} |
                      Max Attempts: {assignment.max_attempts || 'Unlimited'}
                    </div>
                    <div className="muted" style={{ fontSize: '0.8em' }}>
                      Students: {assignment.students_attempted}/{assignment.total_targets} attempted | 
                      Total Attempts: {assignment.total_attempts}
                    </div>
                  </div>
                <div className="row" style={{ gap: 8 }}>
                  <button 
                    onClick={() => window.open(`/assignments/${assignment.id}/marksheet`, '_blank')}
                    style={{ 
                      padding: '8px 16px', 
                      backgroundColor: '#4299e1', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    View Marksheet
                  </button>
                  <button 
                    onClick={() => openEditDialog(assignment)}
                    style={{ 
                      padding: '8px 16px', 
                      backgroundColor: '#38a169', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Edit
                  </button>
                  <button onClick={() => deleteAssignment(assignment.id)} className="danger">
                    Delete
                  </button>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {showCreateDialog && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 8,
          padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 700,
          maxHeight: '90vh',
          overflow: 'auto',
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 16, fontSize: '1.3em' }}>Create New Assignment</h3>
          <div className="grid cols-2" style={{ gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Assignment Title</label>
              <input 
                placeholder="Enter assignment title" 
                value={title} 
                onChange={e=>setTitle(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Assignment Type</label>
              <select 
                value={assignmentType} 
                onChange={e=>handleTypeChange(e.target.value as 'lesson' | 'assessment')}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }}
              >
                <option value="lesson">Lesson</option>
                <option value="assessment">Assessment</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Select {assignmentType === 'lesson' ? 'Lesson' : 'Assessment'}</label>
              <select 
                value={refId} 
                onChange={e=>setRefId(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }}
              >
                <option value="">Select {assignmentType === 'lesson' ? 'Lesson' : 'Assessment'}</option>
                {assignmentType === 'lesson' 
                  ? lessons.map(l=> <option key={l.id} value={l.id}>{l.title}</option>)
                  : assessments.map(a=> <option key={a.id} value={a.id}>{a.title}</option>)
                }
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Due Date</label>
              <input 
                type="datetime-local" 
                value={dueAt} 
                onChange={e=>setDueAt(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Max Attempts (optional)</label>
              <input 
                placeholder="Enter max attempts" 
                type="number" 
                min="1"
                value={maxAttempts} 
                onChange={e=>setMaxAttempts(e.target.value ? parseInt(e.target.value) : '')}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }} 
              />
            </div>
          </div>
          <div className="grid cols-3" style={{ gap: 12, marginBottom: 16 }}>
            <div>
              <h4 style={{ color: '#f7fafc', marginBottom: 8, fontSize: '0.95em' }}>Classes</h4>
              <input
                type="text"
                placeholder="Search classes..."
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px', 
                  marginBottom: '6px',
                  borderRadius: '4px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '12px'
                }}
              />
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #4a5568', borderRadius: '6px', padding: '6px' }}>
                {filteredClasses.length === 0 ? (
                  <div style={{ color: '#a0aec0', fontStyle: 'italic', textAlign: 'center', padding: '8px', fontSize: '12px' }}>
                    No classes found
                  </div>
                ) : (
                  filteredClasses.map(c=> (
                  <div key={c.id} className="row" style={{ justifyContent:'space-between', marginBottom: 4, padding: '6px', backgroundColor: '#1a202c', borderRadius: '4px' }}>
                    <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{c.name}</span>
                    <button 
                      className="secondary" 
                      onClick={()=>addTarget({ type:'class', id:c.id })}
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '11px', 
                        backgroundColor: '#4299e1', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >Add</button>
                  </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#f7fafc', marginBottom: 8, fontSize: '0.95em' }}>Students</h4>
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearchTerm}
                onChange={(e) => setStudentSearchTerm(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '6px', 
                  marginBottom: '6px',
                  borderRadius: '4px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '12px'
                }}
              />
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #4a5568', borderRadius: '6px', padding: '6px' }}>
                {filteredStudents.length === 0 ? (
                  <div style={{ color: '#a0aec0', fontStyle: 'italic', textAlign: 'center', padding: '8px', fontSize: '12px' }}>
                    No students found
                  </div>
                ) : (
                  filteredStudents.map(s=> (
                  <div key={s.id} className="row" style={{ justifyContent:'space-between', marginBottom: 4, padding: '6px', backgroundColor: '#1a202c', borderRadius: '4px' }}>
                    <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{s.firstName} {s.lastName}</span>
                    <button 
                      className="secondary" 
                      onClick={()=>addTarget({ type:'student', id:s.id })}
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '11px', 
                        backgroundColor: '#4299e1', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >Add</button>
                  </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <h4 style={{ color: '#f7fafc', marginBottom: 8, fontSize: '0.95em' }}>Assigned Classes/Students</h4>
              <div style={{ maxHeight: '226px', overflowY: 'auto', border: '1px solid #4a5568', borderRadius: '6px', padding: '6px' }}>
                {targets.length === 0 ? (
                  <div style={{ color: '#a0aec0', fontStyle: 'italic', padding: '8px', fontSize: '12px' }}>No classes or students assigned</div>
                ) : (
                  targets.map(t=> {
                    const targetName = t.type === 'class' 
                      ? classes.find(c => c.id === t.id)?.name || 'Unknown Class'
                      : students.find(s => s.id === t.id) ? `${students.find(s => s.id === t.id)?.firstName} ${students.find(s => s.id === t.id)?.lastName}` : 'Unknown Student'
                    return (
                      <div key={`${t.type}-${t.id}`} className="row" style={{ justifyContent:'space-between', marginBottom: 4, padding: '6px', backgroundColor: '#1a202c', borderRadius: '4px' }}>
                        <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{targetName}</span>
                        <button 
                          className="danger" 
                          onClick={()=>removeTarget(t)}
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '11px', 
                            backgroundColor: '#e53e3e', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >Remove</button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button 
              onClick={closeCreateDialog}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >Cancel</button>
            <button 
              onClick={create}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#4299e1', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >Create Assignment</button>
          </div>
          
          {message && (
            <div style={{ 
              marginTop: 12, 
              padding: '8px', 
              borderRadius: '6px', 
              backgroundColor: message.includes('created') ? '#22543d' : '#742a2a',
              color: message.includes('created') ? '#68d391' : '#fc8181',
              fontSize: '12px'
            }}>
              {message}
            </div>
          )}
      </div>
      )}

      {showCreateDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 999
        }} onClick={closeCreateDialog} />
      )}

      {showEditDialog && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: '#2d3748', 
          border: '2px solid #4a5568', 
          borderRadius: 8,
          padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
          color: '#e2e8f0'
        }}>
          <h3 style={{ color: '#f7fafc', marginBottom: 16, fontSize: '1.3em' }}>Edit Assignment</h3>
          <div className="grid cols-2" style={{ gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Assignment Title</label>
              <input 
                placeholder="Enter assignment title" 
                value={title} 
                onChange={e=>setTitle(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Due Date</label>
              <input 
                type="datetime-local"
                value={dueAt} 
                onChange={e=>setDueAt(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  border: '1px solid #4a5568', 
                  backgroundColor: '#1a202c', 
                  color: '#e2e8f0',
                  fontSize: '13px'
                }} 
              />
            </div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, color: '#cbd5e0', fontWeight: '500', fontSize: '13px' }}>Max Attempts</label>
            <input 
              type="number"
              placeholder="Leave empty for unlimited" 
              value={maxAttempts} 
              onChange={e=>setMaxAttempts(e.target.value === '' ? '' : parseInt(e.target.value))}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '6px', 
                border: '1px solid #4a5568', 
                backgroundColor: '#1a202c', 
                color: '#e2e8f0',
                fontSize: '13px'
              }} 
            />
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button 
              onClick={closeEditDialog}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#4a5568', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >Cancel</button>
            <button 
              onClick={updateAssignment}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#38a169', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >Update Assignment</button>
          </div>
          
          {message && (
            <div style={{ 
              marginTop: 12, 
              padding: '8px', 
              borderRadius: '6px', 
              backgroundColor: message.includes('updated') ? '#22543d' : '#742a2a',
              color: message.includes('updated') ? '#68d391' : '#fc8181',
              fontSize: '12px'
            }}>
              {message}
            </div>
          )}
        </div>
      )}

      {showEditDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 999
        }} onClick={closeEditDialog} />
      )}
    </div>
  )
}


