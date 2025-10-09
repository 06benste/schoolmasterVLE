import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

// Component to display students for a specific class
function ClassStudentsList({ classId, className, onRemoveStudent }: { 
  classId: string; 
  className: string; 
  onRemoveStudent: (classId: string, studentId: string) => void;
}) {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStudents() {
      setLoading(true)
      try {
        const res = await api.get(`/classes/${classId}/students`)
        setStudents(res.data)
      } catch {
        setStudents([])
      } finally {
        setLoading(false)
      }
    }
    loadStudents()
  }, [classId])

  if (loading) {
    return <div className="muted" style={{ padding: '12px', textAlign: 'center' }}>Loading students...</div>
  }

  if (students.length === 0) {
    return (
      <div style={{ 
        marginTop: '12px', 
        padding: '12px', 
        backgroundColor: 'var(--panel)', 
        borderRadius: '6px',
        border: '1px solid var(--border)'
      }}>
        <div className="muted">No students in {className} yet.</div>
      </div>
    )
  }

  return (
    <div style={{ 
      marginTop: '12px', 
      padding: '12px', 
      backgroundColor: 'var(--panel)', 
      borderRadius: '6px',
      border: '1px solid var(--border)'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        Students in {className} ({students.length})
      </div>
      <div className="grid" style={{ gap: 8 }}>
        {students.map(student => (
          <div key={student.id} className="row" style={{ 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '8px',
            backgroundColor: 'var(--bg)',
            borderRadius: '4px',
            border: '1px solid var(--border)'
          }}>
            <div>
              <strong>{student.firstName} {student.lastName}</strong>
              <div className="muted" style={{ fontSize: '0.9em' }}>{student.email}</div>
            </div>
            <button 
              onClick={() => onRemoveStudent(classId, student.id)} 
              className="danger"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Classes(){
  const navigate = useNavigate()
  const [classes, setClasses] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [classStudents, setClassStudents] = useState<any[]>([])
  const [name, setName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [autoArchiveDate, setAutoArchiveDate] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [studentId, setStudentId] = useState('')
  const [editingClass, setEditingClass] = useState<any>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [showManageStudents, setShowManageStudents] = useState(false)
  const [showClassStudents, setShowClassStudents] = useState<string>('')

  const teachers = useMemo(()=> users.filter(u=>u.role==='teacher'), [users])
  const students = useMemo(()=> users.filter(u=>u.role==='student'), [users])

  async function load(){
    const [c, u] = await Promise.all([
      api.get('/classes/placeholder-list'),
      api.get('/users')
    ])
    setClasses(c.data); setUsers(u.data)
    if (!selectedClass && c.data[0]) setSelectedClass(c.data[0].id)
  }

  async function loadClassStudents(){
    if (!selectedClass) { setClassStudents([]); return }
    try {
      const res = await api.get(`/classes/${selectedClass}/students`)
      setClassStudents(res.data)
    } catch {}
  }

  async function loadStudentsForClass(classId: string){
    try {
      const res = await api.get(`/classes/${classId}/students`)
      return res.data
    } catch {
      return []
    }
  }

  useEffect(()=>{ load() },[])
  useEffect(()=>{ loadClassStudents() }, [selectedClass])

  async function createClass(){
    await api.post('/classes', { 
      name, 
      teacherId: teacherId || undefined,
      autoArchiveDate: autoArchiveDate || undefined
    })
    setName(''); setTeacherId(''); setAutoArchiveDate('');
    await load()
  }

  async function addStudent(){
    if (!selectedClass || !studentId) {
      setMessage('Please select both a class and a student')
      return
    }
    try {
      await api.post(`/classes/${selectedClass}/students`, { studentId })
      setMessage('Student added to class successfully')
      setStudentId('')
      await load()
      await loadClassStudents()
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Failed to add student to class')
    }
  }

  async function addSelectedStudents(){
    if (!selectedClass || selectedStudents.length === 0) {
      setMessage('Please select a class and at least one student')
      return
    }
    try {
      // Add students one by one
      for (const studentId of selectedStudents) {
        await api.post(`/classes/${selectedClass}/students`, { studentId })
      }
      setMessage(`${selectedStudents.length} students added to class successfully`)
      setSelectedStudents([])
      setShowBulkAdd(false)
      await load()
      await loadClassStudents()
    } catch (err: any) {
      setMessage(err?.response?.data?.error ?? 'Failed to add students to class')
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  function selectAllStudents() {
    const availableStudents = students.filter(s => !classStudents.some(cs => cs.id === s.id))
    setSelectedStudents(availableStudents.map(s => s.id))
  }

  function clearSelection() {
    setSelectedStudents([])
  }

  async function updateClass(){
    if (!editingClass) return
    try{
      await api.put(`/classes/${editingClass.id}`, { 
        name: editingClass.name, 
        teacherId: editingClass.teacherId,
        autoArchiveDate: editingClass.autoArchiveDate
      })
      setMessage('Class updated successfully')
      setEditingClass(null)
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Update failed')
    }
  }

  async function runAutoArchive(){
    if (!confirm('Run auto-archive process? This will archive all classes that have reached their auto-archive date today.')) return
    try{
      const res = await api.post('/classes/auto-archive')
      setMessage(res.data.message)
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Auto-archive failed')
    }
  }

  async function archiveClass(id: string){
    if (!confirm('Are you sure you want to archive this class? This will also archive all students in the class and they will not be able to log in.')) return
    try{
      await api.post(`/classes/${id}/archive`)
      setMessage('Class and all students archived successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Archive failed')
    }
  }

  async function deleteClass(id: string){
    if (!confirm('Are you sure you want to delete this class? This will remove all students from the class.')) return
    try{
      await api.delete(`/classes/${id}`)
      setMessage('Class deleted successfully')
      await load()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Delete failed')
    }
  }

  async function removeStudent(classId: string, studentId: string){
    if (!confirm('Remove this student from the class?')) return
    try{
      await api.delete(`/classes/${classId}/students/${studentId}`)
      setMessage('Student removed from class')
      await load()
      await loadClassStudents()
    }catch(err: any){
      setMessage(err?.response?.data?.error ?? 'Remove failed')
    }
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      {message && <div className="card">{message}</div>}
      
      {/* Header with Action Buttons */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Classes Management</h2>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => setShowCreateClass(!showCreateClass)} className="button">
              {showCreateClass ? 'Hide Create Class' : '+ Create Class'}
            </button>
            <button onClick={() => setShowManageStudents(!showManageStudents)} className="button secondary">
              {showManageStudents ? 'Hide Manage Students' : 'Manage Students'}
            </button>
            <button onClick={() => navigate('/admin/classes/archived')} className="button secondary">📦 View Archived</button>
            <button onClick={runAutoArchive} className="button secondary">⏰ Run Auto-Archive</button>
          </div>
        </div>
      </div>

      {/* Create Class Section */}
      {showCreateClass && (
        <div className="card">
          <h3>Create New Class</h3>
          <div className="grid cols-3">
            <input placeholder="Class name" value={name} onChange={e=>setName(e.target.value)} />
            <select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
              <option value="">(me)</option>
              {teachers.map(t=> <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
            <input 
              type="date" 
              placeholder="Auto-archive date (optional)" 
              value={autoArchiveDate} 
              onChange={e=>setAutoArchiveDate(e.target.value)}
              title="Optional: Class will be automatically archived on this date"
            />
            <button onClick={createClass}>Create</button>
          </div>
        </div>
      )}

      {/* Manage Students Section */}
      {showManageStudents && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Manage Class Students</h3>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={() => setShowBulkAdd(!showBulkAdd)}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: showBulkAdd ? 'var(--accent)' : 'var(--muted)', 
                  color: 'var(--bg)', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {showBulkAdd ? 'Hide Bulk Add' : 'Bulk Add Students'}
              </button>
            </div>
          </div>

          {!showBulkAdd ? (
            <div>
              <h4>Add Individual Student</h4>
              <div className="grid cols-3">
                <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
                  <option value="">Select class</option>
                  {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={studentId} onChange={e=>setStudentId(e.target.value)}>
                  <option value="">Select student</option>
                  {students.map(s=> <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
                <button onClick={addStudent} disabled={!selectedClass || !studentId}>Add</button>
              </div>
            </div>
          ) : (
            <div>
              <h4>Bulk Add Students</h4>
              <div style={{ marginBottom: 16 }}>
                <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
                  <option value="">Select class</option>
                  {classes.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              {selectedClass && (
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <strong>Available Students ({students.filter(s => !classStudents.some(cs => cs.id === s.id)).length})</strong>
                      <div className="muted" style={{ fontSize: '0.9em' }}>
                        Select students to add to {classes.find(c => c.id === selectedClass)?.name}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={selectAllStudents} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        Select All
                      </button>
                      <button onClick={clearSelection} style={{ padding: '6px 12px', fontSize: '12px' }}>
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border)', 
                    borderRadius: '8px', 
                    padding: '12px',
                    backgroundColor: 'var(--panel)'
                  }}>
                    {students.filter(s => !classStudents.some(cs => cs.id === s.id)).length === 0 ? (
                      <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
                        All students are already in this class
                      </div>
                    ) : (
                      students
                        .filter(s => !classStudents.some(cs => cs.id === s.id))
                        .map(student => (
                          <div key={student.id} className="row" style={{ 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '8px 0',
                            borderBottom: '1px solid var(--border)'
                          }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                              <input 
                                type="checkbox" 
                                checked={selectedStudents.includes(student.id)}
                                onChange={() => toggleStudentSelection(student.id)}
                                style={{ margin: 0 }}
                              />
                              <div>
                                <strong>{student.firstName} {student.lastName}</strong>
                                <div className="muted" style={{ fontSize: '0.9em' }}>{student.email}</div>
                              </div>
                            </label>
                          </div>
                        ))
                    )}
                  </div>
                  
                  <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
                    <button onClick={() => setShowBulkAdd(false)}>
                      Cancel
                    </button>
                    <button 
                      onClick={addSelectedStudents} 
                      disabled={selectedStudents.length === 0}
                      style={{ 
                        backgroundColor: selectedStudents.length === 0 ? 'var(--muted)' : 'var(--accent)',
                        color: 'var(--bg)'
                      }}
                    >
                      Add {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space" />
          <div className="muted">
            Available classes: {classes.length} | Available students: {students.length}
          </div>
          {classes.length === 0 && (
            <div className="muted" style={{ color: '#d32f2f' }}>
              ⚠️ No classes available. Create a class first.
            </div>
          )}
          {students.length === 0 && (
            <div className="muted" style={{ color: '#d32f2f' }}>
              ⚠️ No students available. Create student users first.
            </div>
          )}
        </div>
      )}

      {/* Classes List */}
      <div className="card">
        <h3>Classes</h3>
        <div className="grid" style={{ gap: 8 }}>
          {classes.map(c => {
            const t = users.find(u=>u.id===c.teacherId)
            return (
              <div key={c.id} className="card">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{c.name}</strong>
                    <div className="muted">Teacher: {t? `${t.firstName} ${t.lastName}`: '—'}</div>
                    {c.autoArchiveDate && (
                      <div className="muted" style={{ fontSize: '0.9em', color: '#f59e0b' }}>
                        📅 Auto-archive: {new Date(c.autoArchiveDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button 
                      onClick={() => setShowClassStudents(showClassStudents === c.id ? '' : c.id)}
                      className="button secondary"
                    >
                      {showClassStudents === c.id ? 'Hide Students' : 'View Students'}
                    </button>
                    <Link to={`/classes/${c.id}/marksheet`} className="button">Marksheet</Link>
                    <button onClick={() => setEditingClass({...c})}>Edit</button>
                    <button onClick={() => archiveClass(c.id)} className="secondary">Archive</button>
                    <button onClick={() => deleteClass(c.id)} className="danger">Delete</button>
                  </div>
                </div>
                
                {/* Students for this class */}
                {showClassStudents === c.id && (
                  <ClassStudentsList 
                    classId={c.id} 
                    className={c.name}
                    onRemoveStudent={removeStudent}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: 'var(--panel)', 
          border: '2px solid var(--border)', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: 500,
          color: 'var(--text)'
        }}>
          <h3 style={{ color: 'var(--text)', marginBottom: 24, fontSize: '1.5em' }}>Edit Class</h3>
          <div className="grid cols-2" style={{ gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontWeight: '500' }}>Class Name</label>
              <input 
                placeholder="Enter class name" 
                value={editingClass.name} 
                onChange={e => setEditingClass({...editingClass, name: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--bg)', 
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontWeight: '500' }}>Teacher</label>
              <select 
                value={editingClass.teacherId} 
                onChange={e => setEditingClass({...editingClass, teacherId: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--bg)', 
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
              >
                <option value="">(me)</option>
                {teachers.map(t=> <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)', fontWeight: '500' }}>Auto-Archive Date (Optional)</label>
              <input 
                type="date" 
                placeholder="Auto-archive date (optional)" 
                value={editingClass.autoArchiveDate || ''} 
                onChange={e => setEditingClass({...editingClass, autoArchiveDate: e.target.value})}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--bg)', 
                  color: 'var(--text)',
                  fontSize: '14px'
                }}
                title="Optional: Class will be automatically archived on this date"
              />
            </div>
          </div>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setEditingClass(null)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: 'var(--muted)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >Cancel</button>
            <button 
              onClick={updateClass}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: 'var(--accent)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >Update Class</button>
          </div>
        </div>
      )}

      {editingClass && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 999
        }} onClick={() => setEditingClass(null)} />
      )}
    </div>
  )
}


