import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface PasswordChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  forced?: boolean // If true, modal cannot be closed until password is changed
}

export default function PasswordChangeModal({ isOpen, onClose, onSuccess, forced = false }: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
    }
  }, [isOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

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
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        userId: user.id
      })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Password change failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={forced ? undefined : onClose}
    >
      <div 
        className="card" 
        style={{ 
          backgroundColor: 'var(--panel)', 
          border: '2px solid var(--border)', 
          borderRadius: 12,
          padding: 32,
          maxWidth: 400,
          width: '90%',
          color: 'var(--text)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', textAlign: 'center', color: 'var(--text)' }}>
          {forced ? 'Password Change Required' : 'Change Password Required'}
        </h2>
            <p style={{ margin: '0 0 20px 0', textAlign: 'center', color: 'var(--muted)' }}>
              {forced 
                ? 'You must change your password before you can access the system.'
                : 'You must change your password before continuing.'
              }
            </p>
            <div style={{ 
              backgroundColor: 'var(--accent-light)', 
              border: '1px solid var(--accent)', 
              borderRadius: '6px', 
              padding: '12px', 
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <strong style={{ color: 'var(--accent-dark)' }}>Password Requirements:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: 'var(--text)' }}>
                <li>At least 8 characters long</li>
                <li>One uppercase letter (A-Z)</li>
                <li>One lowercase letter (a-z)</li>
                <li>One number (0-9)</li>
                <li>One special character (!@#$%^&*...)</li>
              </ul>
            </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: 'var(--text)' }}>
              Current Password:
            </label>
            <input 
              type="password" 
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)'
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: 'var(--text)' }}>
              New Password:
            </label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)'
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: 'var(--text)' }}>
              Confirm New Password:
            </label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)'
              }}
            />
          </div>

          {error && (
            <div style={{ 
              backgroundColor: 'var(--danger)',
              border: '1px solid var(--danger-dark)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              color: 'white'
            }}>
              {error}
            </div>
          )}

          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            {!forced && (
              <button 
                type="button"
                onClick={onClose}
                className="secondary"
                disabled={loading}
              >
                Cancel
              </button>
            )}
            <button 
              type="submit" 
              className="button"
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
