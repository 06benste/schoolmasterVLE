import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import HelpButton from '../../components/HelpButton'

type Role = 'admin'|'teacher'|'student'

export default function Users(){
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('teacher')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [changingPassword, setChangingPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<any>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importJobId, setImportJobId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<any>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const usersPerPage = 50

  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) setCurrentUser(JSON.parse(user))
  }, [])

  async function load(){
    const res = await api.get('/users')
    setList(res.data)
  }

  useEffect(()=>{ load() },[])

  // Check for active import job on page load (survives refresh)
  useEffect(() => {
    const savedJobId = localStorage.getItem('importJobId')
    if (savedJobId) {
      setImportJobId(savedJobId)
      setIsImporting(true)
      checkImportStatus(savedJobId)
    }
  }, [])

  // Poll import status when job is active
  useEffect(() => {
    if (!importJobId) return

    const interval = setInterval(() => {
      checkImportStatus(importJobId)
    }, 2000)

    return () => clearInterval(interval)
  }, [importJobId])

  async function checkImportStatus(jobId: string) {
    try {
      const res = await api.get(`/users/import-status/${jobId}`)
      setImportStatus(res.data)
      
      // Update isImporting based on actual status
      if (res.data.status === 'processing' || res.data.status === 'queued') {
        setIsImporting(true)
      } else if (res.data.status === 'completed' || res.data.status === 'failed' || res.data.status === 'cancelled') {
        setIsImporting(false)
        localStorage.removeItem('importJobId')
        // DON'T clear importJobId yet - we need it for downloading the password CSV
        // It will be cleared when the dialog is closed
        if (res.data.status === 'completed' || res.data.status === 'cancelled') {
          await load() // Refresh user list
        }
      }
    } catch (err: any) {
      console.error('Failed to check import status:', err)
      setIsImporting(false)
      localStorage.removeItem('importJobId')
      setImportJobId(null)
    }
  }

  async function create(){
    setError(null)
    try{
      const res = await api.post('/users', { username, email, role, firstName, lastName })
      
      // Show the generated password if one was created
      if (res.data.tempPassword) {
        alert(`User created successfully!\n\nUsername: ${res.data.username}\nTemporary Password: ${res.data.tempPassword}\n\n⚠️ IMPORTANT: Save this password now!\nIt will not be shown again. The user must use this password to log in for the first time.`);
      }
      
      setUsername(''); setEmail(''); setFirstName(''); setLastName('');
      setShowCreateDialog(false)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Failed') }
  }

  function openCreateDialog(){
    setShowCreateDialog(true)
    setUsername(''); setEmail(''); setFirstName(''); setLastName(''); setRole('teacher')
    setError(null)
  }

  function closeCreateDialog(){
    setShowCreateDialog(false)
    setError(null)
  }

  async function updateUser(){
    if (!editingUser) return
    setError(null)
    try{
      await api.put(`/users/${editingUser.id}`, { 
        email: editingUser.email, 
        role: editingUser.role, 
        firstName: editingUser.firstName, 
        lastName: editingUser.lastName 
      })
      setEditingUser(null)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Update failed') }
  }

  async function archiveUser(id: string){
    if (!confirm('Are you sure you want to archive this user? They will not be able to log in.')) return
    setError(null)
    try{
      await api.post(`/users/${id}/archive`)
      setError('User archived successfully')
      setTimeout(() => setError(null), 3000)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Archive failed') }
  }

  async function deleteUser(id: string){
    if (!confirm('Are you sure you want to delete this user?')) return
    setError(null)
    try{
      await api.delete(`/users/${id}`)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Delete failed') }
  }

  function startEdit(user: any){
    setEditingUser({...user})
  }

  async function changePassword(userId: string){
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    
    setError(null)
    try{
      await api.put(`/users/${userId}/password`, { newPassword })
      setChangingPassword('')
      setNewPassword('')
      setError('Password changed successfully')
      // Clear success message after 3 seconds
      setTimeout(() => setError(null), 3000)
    }catch(err: any){ 
      setError(err?.response?.data?.error ?? 'Password change failed') 
    }
  }

  function startPasswordChange(userId: string){
    setChangingPassword(userId)
    setNewPassword('')
    setError(null)
  }

  function cancelPasswordChange(){
    setChangingPassword('')
    setNewPassword('')
    setError(null)
  }

  async function handleCsvImport(){
    if (!csvFile) return
    setError(null)
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('csvFile', csvFile)
      const res = await api.post('/users/import-csv-async', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const jobId = res.data.jobId
      setImportJobId(jobId)
      localStorage.setItem('importJobId', jobId)
      setCsvFile(null)
      
      // Start polling immediately
      checkImportStatus(jobId)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Import failed')
      setIsImporting(false)
    }
  }

  async function handleCancelImport() {
    if (!importJobId) return
    try {
      await api.post(`/users/import-cancel/${importJobId}`)
      setIsImporting(false)
      localStorage.removeItem('importJobId')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Cancel failed')
    }
  }

  async function handleCsvExport(){
    try {
      const res = await api.get('/users/export-csv', {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'users_export.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Export failed')
    }
  }

  async function downloadTemplate(){
    try {
      const res = await api.get('/users/csv-template', {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'users_template.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Template download failed')
    }
  }

  async function downloadPasswordsCsv(){
    if (!importJobId) {
      setError('Import session expired. Please import again to download passwords.')
      return
    }
    try {
      const res = await api.get(`/users/import-download-csv/${importJobId}`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `imported_users_passwords_${importJobId}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      // Show success message
      setError('✅ Password CSV downloaded successfully!')
      setTimeout(() => setError(null), 3000)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'CSV download failed')
    }
  }

  function openImportDialog(){
    setShowImportDialog(true)
    setCsvFile(null)
    setImportResults(null)
    setError(null)
  }

  function closeImportDialog(){
    // Don't allow closing if import is in progress
    if (isImporting) {
      console.log('⚠️ Import in progress - dialog cannot be closed');
      return
    }
    
    setShowImportDialog(false)
    setCsvFile(null)
    setImportResults(null)
    setError(null)
    setImportStatus(null)
    setImportJobId(null)
  }

  // Filter and paginate users
  const filteredUsers = list.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage)
  const startIndex = (currentPage - 1) * usersPerPage
  const endIndex = startIndex + usersPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="grid gap-16" style={{ position: 'relative' }}>
      {/* Global shield overlay during import - blocks all interactions */}
      {isImporting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1999,
          pointerEvents: 'all'
        }} />
      )}
      
      <div className="card">
        <div className="row justify-between items-center">
          <h3 style={{ margin: 0 }}>User Management</h3>
          <div className="row gap-8">
            <button onClick={downloadTemplate} className="button secondary">📄 Download Template</button>
            <button onClick={handleCsvExport} className="button secondary">📤 Export CSV</button>
            <button onClick={openImportDialog} className="button secondary">📥 Import CSV</button>
            <button onClick={() => navigate('/admin/users/archived')} className="button secondary">📦 View Archived</button>
            <button onClick={openCreateDialog} className="button">+ Create New User</button>
          </div>
        </div>
      </div>


      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Users ({filteredUsers.length})</h3>
          <input
            type="text"
            placeholder="Search users... (username, email, name, role)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              width: '350px'
            }}
          />
        </div>
        
        {filteredUsers.length === 0 ? (
          <div style={{ 
            padding: '32px', 
            textAlign: 'center', 
            color: 'var(--muted)',
            fontSize: '14px'
          }}>
            {searchTerm ? 'No users found matching your search.' : 'No users found.'}
          </div>
        ) : (
          <>
        <table className="table">
          <thead>
            <tr><th>Username</th><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
                {paginatedUsers.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.role}</td>
                <td className="muted">{u.createdAt}</td>
                <td>
                  <div className="row gap-8">
                    <button onClick={() => startEdit(u)}>Edit</button>
                    <button onClick={() => startPasswordChange(u.id)}>Change Password</button>
                    <button onClick={() => archiveUser(u.id)} className="secondary">Archive</button>
                    {!(u.role === 'admin' && currentUser?.role === 'admin') && (
                      <button onClick={() => deleteUser(u.id)} className="danger">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px', 
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)'
              }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                <span style={{ 
                  padding: '0 16px', 
                  fontSize: '14px',
                  color: 'var(--text)'
                }}>
                  Page {currentPage} of {totalPages} ({filteredUsers.length} users)
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    fontSize: '14px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Last
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {editingUser && (
        <div className="modal modal-large">
          <h3 className="modal-header">Edit User</h3>
          <div className="modal-content">
            <div className="grid cols-2 gap-16 mb-24">
              <div className="form-group">
                <label className="form-label">Email</label>
            <input 
                  className="form-input"
                  placeholder="Enter email" 
              value={editingUser.email} 
              onChange={e => setEditingUser({...editingUser, email: e.target.value})} 
            />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
            <select 
                  className="form-select"
              value={editingUser.role} 
              onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})}
            >
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
              </div>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input 
                  className="form-input"
                  placeholder="Enter first name" 
                  value={editingUser.firstName} 
                  onChange={e => setEditingUser({...editingUser, firstName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input 
                  className="form-input"
                  placeholder="Enter last name" 
                  value={editingUser.lastName} 
                  onChange={e => setEditingUser({...editingUser, lastName: e.target.value})}
                />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button 
              className="btn-secondary"
              onClick={() => setEditingUser(null)}
            >Cancel</button>
            <button 
              className="btn-primary"
              onClick={updateUser}
            >Update User</button>
          </div>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)} />
      )}

      {changingPassword && (
        <div className="modal">
          <h3 className="modal-header">Change Password</h3>
          <div className="modal-content">
            <div className="form-group">
              <label className="form-label">New Password</label>
            <input 
                className="form-input"
                placeholder="Enter new password (minimum 6 characters)" 
              type="password"
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
            />
            </div>
            <div className="alert alert-warning">
              ⚠️ The user will need to log in with this new password immediately.
            </div>
          </div>
          <div className="modal-actions">
            <button 
              className="btn-secondary"
              onClick={cancelPasswordChange}
            >Cancel</button>
            <button 
              className="btn-primary"
              onClick={() => changePassword(changingPassword)}
            >Change Password</button>
          </div>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>
      )}

      {changingPassword && (
        <div className="modal-overlay" onClick={cancelPasswordChange} />
      )}

      {showCreateDialog && (
        <div className="modal modal-large">
          <h3 className="modal-header">Create New User</h3>
          <div className="modal-content">
            <div className="grid cols-2 gap-16 mb-24">
              <div className="form-group">
                <label className="form-label">Username</label>
              <input 
                  className="form-input"
                placeholder="Enter username" 
                value={username} 
                onChange={e=>setUsername(e.target.value)}
              />
            </div>
              <div className="form-group">
                <label className="form-label">Email (optional)</label>
              <input 
                  className="form-input"
                placeholder="Enter email" 
                value={email} 
                onChange={e=>setEmail(e.target.value)}
              />
            </div>
              <div className="form-group">
                <div className="alert alert-info">
                  ℹ️ A random temporary password will be generated for this user. Make sure to save it when displayed!
                </div>
            </div>
              <div className="form-group">
                <label className="form-label">Role</label>
              <select 
                  className="form-select"
                value={role} 
                onChange={e=>setRole(e.target.value as Role)}
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>
              <div className="form-group">
                <label className="form-label">First Name</label>
              <input 
                  className="form-input"
                placeholder="Enter first name" 
                value={firstName} 
                onChange={e=>setFirstName(e.target.value)}
              />
            </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
              <input 
                  className="form-input"
                placeholder="Enter last name" 
                value={lastName} 
                onChange={e=>setLastName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button 
              className="btn-secondary"
              onClick={closeCreateDialog}
            >Cancel</button>
            <button 
              className="btn-primary"
              onClick={create}
            >Create User</button>
          </div>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>
      )}

      {showCreateDialog && (
        <div className="modal-overlay" onClick={closeCreateDialog} />
      )}

      {showImportDialog && (
        <div className="modal" style={{ maxWidth: 700, width: '90%', zIndex: 2001 }}>
          <h3 className="modal-header">
            {isImporting ? '🔄 Importing Users...' : 'Import Users from CSV'}
          </h3>
          
          {isImporting && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '6px',
              padding: '12px',
              margin: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
                ⚠️ IMPORT IN PROGRESS
              </div>
              <div style={{ fontSize: '14px', color: '#92400e' }}>
                Please do not close this dialog until the import is complete.
              </div>
            </div>
          )}
          
          <div className="modal-content">
            {!isImporting && !importStatus && (
              <>
            <div className="form-group">
              <label className="form-label">
                Select CSV File:
              </label>
              <input 
                className="form-input"
                type="file" 
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="alert alert-warning" style={{ fontSize: '0.9em' }}>
              <strong>CSV Format:</strong><br/>
              • Required columns: name, surname, username<br/>
              • Optional columns: email, archive_date, class1, class2, class3, class4, class5, class6, class7, class8, class9, class10<br/>
              • Class names will be created if they don't exist<br/>
              • Each user will be assigned a unique random password<br/>
              • After import completes, download the CSV file with usernames and passwords
            </div>
              </>
            )}

            {/* Progress Panel - shows when importing or has results */}
            {(isImporting || importStatus) && (
              <div style={{ backgroundColor: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>
                  {importStatus?.status === 'processing' || isImporting ? '🔄 Import in Progress' : 
                   importStatus?.status === 'completed' ? '✅ Import Complete' :
                   importStatus?.status === 'failed' ? '❌ Import Failed' :
                   importStatus?.status === 'cancelled' ? '⚠️ Import Cancelled' : 
                   '🔄 Import in Progress'}
                </h4>
                
                {importStatus && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px', 
                        fontWeight: 'bold',
                        backgroundColor: importStatus.status === 'completed' ? 'var(--success)' : 
                                        importStatus.status === 'failed' ? 'var(--danger)' : 
                                        importStatus.status === 'cancelled' ? '#f59e0b' :
                                        'var(--accent)',
                        color: 'white'
                      }}>
                        {importStatus.status.toUpperCase()}
                      </span>
                      {importStatus.total > 0 && (
                        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                          {importStatus.current} / {importStatus.total} processed
                        </span>
                      )}
                    </div>
                    
                    {importStatus.total > 0 && (
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        backgroundColor: 'var(--border)', 
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${Math.min(100, (importStatus.current / importStatus.total) * 100)}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--accent)', 
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Messages Log */}
                {importStatus?.messages && importStatus.messages.length > 0 && (
                  <div style={{ 
                    backgroundColor: 'var(--bg)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '6px', 
                    padding: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '14px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--text)' }}>Progress Log:</div>
                    {importStatus.messages.map((msg: string, i: number) => (
                      <div key={i} style={{ 
                        marginBottom: '4px', 
                        color: 'var(--muted)',
                        fontFamily: 'monospace'
                      }}>
                        {msg}
                      </div>
                    ))}
                  </div>
                )}

                {/* Results Summary */}
                {importStatus?.result && (
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: 'var(--accent-light)', 
                    borderRadius: '6px',
                    border: '1px solid var(--accent)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--accent-dark)' }}>Results:</div>
                    <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                      ✅ {importStatus.result.createdCount} users created<br/>
                      🏫 {importStatus.result.classesCreatedCount} classes created<br/>
                      ❌ {importStatus.result.errorCount} errors
                    </div>
                    {importStatus.result.createdUsers && importStatus.result.createdUsers.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={downloadPasswordsCsv}
                          style={{
                            padding: '10px 16px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            width: '100%'
                          }}
                        >
                          📥 Download CSV with Usernames & Passwords
                        </button>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px', textAlign: 'center' }}>
                          ⚠️ Save this file securely! It contains all temporary passwords for the imported users.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error List */}
                {importStatus?.errors && importStatus.errors.length > 0 && (
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: 'var(--danger-light)', 
                    borderRadius: '6px',
                    border: '1px solid var(--danger)',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--danger-dark)' }}>
                      Errors ({importStatus.errors.length}):
                    </div>
                    {importStatus.errors.map((err: string, i: number) => (
                      <div key={i} style={{ 
                        marginBottom: '2px', 
                        fontSize: '12px',
                        color: 'var(--danger-dark)',
                        fontFamily: 'monospace'
                      }}>
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Error Display */}
                {importStatus?.error && (
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: 'var(--danger-light)', 
                    borderRadius: '6px',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger-dark)'
                  }}>
                    <strong>Import Failed:</strong> {importStatus.error}
                  </div>
                )}

                {isImporting && (
                  <div>
                    <div className="alert alert-info" style={{ fontSize: '0.9em', marginBottom: '12px' }}>
                      <strong>Please wait...</strong><br/>
                      The import is processing in the background. You can cancel the import if needed.
                    </div>
                    <button
                      onClick={handleCancelImport}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--danger)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        width: '100%'
                      }}
                    >
                      Cancel Import
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions">
            {isImporting ? (
              <div style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
                Import in progress... Please wait
              </div>
            ) : importStatus ? (
              <button 
                onClick={closeImportDialog} 
                className="btn-primary"
                disabled={isImporting}
                style={{
                  opacity: isImporting ? 0.5 : 1,
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
              >
                Close
              </button>
            ) : (
              <>
                <button 
                  onClick={closeImportDialog} 
                  className="btn-secondary"
                  disabled={isImporting}
                  style={{
                    opacity: isImporting ? 0.5 : 1,
                    cursor: isImporting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCsvImport} 
                  className="btn-primary"
                  disabled={!csvFile || isImporting}
                >
                  Import Users
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showImportDialog && (
        <div className="modal-overlay" onClick={isImporting ? undefined : closeImportDialog} style={{ zIndex: 2000 }} />
      )}

      {error && (
        <div className={`alert ${error.includes('successfully') ? 'alert-success' : 'alert-error'}`}>
          {error}
        </div>
      )}
      
      <HelpButton 
        pageName="User Management" 
        helpContent={`<h4>User Management System</h4>
        
<p><strong>Creating Users:</strong></p>
<ul>
<li>Click "Create New User" to add individual users</li>
<li>Fill in username, email, and role (password will be set to "TempPass123!")</li>
<li>Choose role: Admin, Teacher, or Student</li>
</ul>

<p><strong>Bulk Import:</strong></p>
<ul>
<li><strong>Download Template:</strong> Get CSV template with proper format</li>
<li><strong>Import CSV:</strong> Upload file with multiple users</li>
<li><strong>Export CSV:</strong> Download current user data</li>
<li>CSV format: name, surname, username, class1, class2, etc.</li>
</ul>

<p><strong>User Roles:</strong></p>
<ul>
<li><strong>Admin:</strong> Full system access, can manage everything</li>
<li><strong>Teacher:</strong> Can create content and manage classes</li>
<li><strong>Student:</strong> Can access assigned content and submit work</li>
</ul>

<p><strong>Managing Users:</strong></p>
<ul>
<li><strong>Edit:</strong> Modify user details and roles</li>
<li><strong>Change Password:</strong> Reset user passwords</li>
<li><strong>Delete:</strong> Remove users from the system</li>
</ul>

<p><strong>Class Assignment:</strong></p>
<ul>
<li>Use the "Classes" page to assign students to classes</li>
<li>Students can be in multiple classes</li>
<li>Class assignments determine content visibility</li>
</ul>`}
      />
    </div>
  )
}


