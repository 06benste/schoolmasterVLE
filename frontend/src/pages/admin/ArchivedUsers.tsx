import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

export default function ArchivedUsers(){
  const [list, setList] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function load(){
    try {
      const res = await api.get('/users/archived')
      setList(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load archived users')
    }
  }

  useEffect(()=>{ load() },[])

  async function restoreUser(id: string){
    if (!confirm('Are you sure you want to restore this user? They will be able to log in again.')) return
    setError(null)
    try{
      await api.post(`/users/${id}/restore`)
      setError('User restored successfully')
      setTimeout(() => setError(null), 3000)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Restore failed') }
  }

  async function deleteUser(id: string){
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return
    setError(null)
    try{
      await api.delete(`/users/${id}`)
      setError('User deleted permanently')
      setTimeout(() => setError(null), 3000)
      await load()
    }catch(err: any){ setError(err?.response?.data?.error ?? 'Delete failed') }
  }

  return (
    <div className="grid" style={{ gap:16 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Archived Users</h3>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => navigate('/admin/users')} className="button secondary">← Back to Users</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Archived Users ({list.length})</h3>
        {list.length === 0 ? (
          <div className="muted" style={{ textAlign: 'center', padding: 20 }}>
            No archived users found.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Username</th><th>Email</th><th>Name</th><th>Role</th><th>Archived</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.role}</td>
                  <td className="muted">{u.archivedAt}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <button onClick={() => restoreUser(u.id)}>Restore</button>
                      <button onClick={() => deleteUser(u.id)} className="danger">Delete Permanently</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  )
}
