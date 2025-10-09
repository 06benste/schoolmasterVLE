import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    // Validation
    if (!currentPassword) {
      setError('Current password is required')
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long')
      setLoading(false)
      return
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumbers = /\d/.test(newPassword)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
      setLoading(false)
      return
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        userId: user.id
      })
      
      setSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Password change failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div className="loading">Loading profile...</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '24px', color: 'var(--text)' }}>👤 My Profile</h2>
      
      <div style={{ display: 'grid', gap: '24px', maxWidth: '600px' }}>
        {/* User Information */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>Account Information</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: 'var(--text)' }}>Username:</label>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg)', borderRadius: '6px', color: 'var(--muted)' }}>
                {user.username}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: 'var(--text)' }}>Name:</label>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg)', borderRadius: '6px', color: 'var(--muted)' }}>
                {user.firstName} {user.lastName}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: 'var(--text)' }}>Role:</label>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg)', borderRadius: '6px', color: 'var(--muted)' }}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </div>
            </div>
            {user.email && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', color: 'var(--text)' }}>Email:</label>
                <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg)', borderRadius: '6px', color: 'var(--muted)' }}>
                  {user.email}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password Change */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>Change Password</h3>
          
          <div style={{ 
            backgroundColor: 'var(--accent-light)', 
            border: '1px solid var(--accent)', 
            borderRadius: '6px', 
            padding: '12px', 
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <strong>Password Requirements:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>At least 8 characters long</li>
              <li>One uppercase letter (A-Z)</li>
              <li>One lowercase letter (a-z)</li>
              <li>One number (0-9)</li>
              <li>One special character (!@#$%^&*...)</li>
            </ul>
          </div>

          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                Current Password *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                New Password *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                required
                minLength={8}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
                minLength={8}
                style={{ width: '100%' }}
              />
            </div>

            {error && (
              <div style={{ 
                backgroundColor: 'var(--danger)',
                color: 'white',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ 
                backgroundColor: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ 
                opacity: loading ? 0.6 : 1,
                backgroundColor: 'var(--accent)'
              }}
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
