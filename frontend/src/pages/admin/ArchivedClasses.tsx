import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

export default function ArchivedClasses(){
  const [list, setList] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState<{classId: string, className: string} | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<{classId: string, className: string} | null>(null)
  const navigate = useNavigate()

  async function load(){
    try {
      const [classesRes, usersRes] = await Promise.all([
        api.get('/classes/archived'),
        api.get('/users')
      ])
      setList(classesRes.data)
      setUsers(usersRes.data)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load archived classes')
    }
  }

  useEffect(()=>{ load() },[])

  function openRestoreDialog(classId: string, className: string){
    setShowRestoreDialog({ classId, className })
  }

  async function restoreClass(restoreStudents: boolean){
    if (!showRestoreDialog) return
    
    setError(null)
    try{
      await api.post(`/classes/${showRestoreDialog.classId}/restore`, { restoreStudents })
      setError('Class restored successfully')
      setTimeout(() => setError(null), 3000)
      setShowRestoreDialog(null)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Restore failed') }
  }

  function openDeleteDialog(classId: string, className: string){
    setShowDeleteDialog({ classId, className })
  }

  async function deleteClass(){
    if (!showDeleteDialog) return
    
    setError(null)
    try{
      await api.delete(`/classes/${showDeleteDialog.classId}`)
      setError('Class deleted permanently')
      setTimeout(() => setError(null), 3000)
      setShowDeleteDialog(null)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Delete failed') }
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Archived Classes</h3>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => navigate('/classes')} className="button secondary">← Back to Classes</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Archived Classes ({list.length})</h3>
        {list.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
            No archived classes found.
          </div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {list.map(c => {
              const teacher = users.find(u => u.id === c.teacherId)
              return (
                <div key={c.id} className="card">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.name}</strong>
                      <div className="muted">Teacher: {teacher ? `${teacher.firstName} ${teacher.lastName}` : '—'}</div>
                      <div className="muted">Archived: {c.archivedAt}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={() => openRestoreDialog(c.id, c.name)}>Restore</button>
                      <button onClick={() => openDeleteDialog(c.id, c.name)} className="danger">Delete Permanently</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ 
          backgroundColor: error.includes('successfully') ? '#1b2d1b' : '#2d1b1b',
          border: `1px solid ${error.includes('successfully') ? '#2c5c2c' : '#5c2c2c'}`,
          color: error.includes('successfully') ? '#9ae6b4' : '#feb2b2'
        }}>
          {error}
        </div>
      )}

      {/* Custom Restore Dialog */}
      {showRestoreDialog && (
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
          <h3 style={{ color: 'var(--text)', marginBottom: 16, fontSize: '1.5em' }}>
            Restore Class: {showRestoreDialog.className}
          </h3>
          
          <div style={{ marginBottom: 24, color: 'var(--text)' }}>
            <p style={{ marginBottom: 16 }}>
              How would you like to restore this class?
            </p>
            
            <div style={{ 
              backgroundColor: 'var(--bg)', 
              padding: 16, 
              borderRadius: 8, 
              border: '1px solid var(--border)',
              marginBottom: 16
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>Option 1: Restore Class Only</h4>
              <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--muted)' }}>
                Restore the class but leave students archived. Students will remain unable to log in.
              </p>
            </div>
            
            <div style={{ 
              backgroundColor: 'var(--bg)', 
              padding: 16, 
              borderRadius: 8, 
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-2)' }}>Option 2: Restore Class + Students</h4>
              <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--muted)' }}>
                Restore the class and all its students. Students will be able to log in again.
              </p>
            </div>
          </div>
          
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowRestoreDialog(null)}
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
              onClick={() => restoreClass(false)}
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
            >Restore Class Only</button>
            <button 
              onClick={() => restoreClass(true)}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: 'var(--accent-2)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >Restore Class + Students</button>
          </div>
        </div>
      )}

      {showRestoreDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 999
        }} onClick={() => setShowRestoreDialog(null)} />
      )}

      {/* Custom Delete Dialog */}
      {showDeleteDialog && (
        <div className="card" style={{ 
          position: 'fixed', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000, 
          backgroundColor: 'var(--panel)', 
          border: '2px solid var(--danger)', 
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: 400,
          color: 'var(--text)'
        }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: 16, fontSize: '1.5em' }}>
            ⚠️ Delete Class Permanently
          </h3>
          
          <div style={{ marginBottom: 24, color: 'var(--text)' }}>
            <p style={{ marginBottom: 16 }}>
              Are you sure you want to permanently delete <strong>{showDeleteDialog.className}</strong>?
            </p>
            
            <div style={{ 
              backgroundColor: 'var(--danger)', 
              padding: 16, 
              borderRadius: 8, 
              border: '1px solid var(--danger)',
              color: 'white'
            }}>
              <h4 style={{ margin: '0 0 8px 0' }}>⚠️ This action cannot be undone!</h4>
              <p style={{ margin: 0, fontSize: '0.9em' }}>
                The class and all associated data will be permanently removed from the system.
              </p>
            </div>
          </div>
          
          <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowDeleteDialog(null)}
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
              onClick={deleteClass}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: 'var(--danger)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >Delete Permanently</button>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 999
        }} onClick={() => setShowDeleteDialog(null)} />
      )}
    </div>
  )
}
