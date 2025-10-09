import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import logoImage from '../assets/logo.jpg'
import { useSchool } from '../contexts/SchoolContext'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [setupComplete, setSetupComplete] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings } = useSchool()

  useEffect(() => {
    if (searchParams.get('setup') === 'complete') {
      setSetupComplete(true)
      setTimeout(() => setSetupComplete(false), 5000)
    }
    
    // Load remembered username
    const rememberedUsername = localStorage.getItem('rememberedUsername')
    if (rememberedUsername) {
      setUsername(rememberedUsername)
      setRememberMe(true)
    }
  }, [searchParams])

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    setError(null)
    try{
      const res = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username)
      } else {
        localStorage.removeItem('rememberedUsername')
      }
      
      // Trigger a storage event to notify SchoolProvider to refresh settings
      window.dispatchEvent(new Event('storage'));
      
      navigate('/dashboard')
    }catch(err: any){
      setError(err?.response?.data?.error ?? 'Login failed')
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px',
      background: 'var(--bg)',
      width: '100%'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img 
          src={settings.schoolLogo ? `/uploads/${settings.schoolLogo}` : logoImage} 
          alt={`${settings.schoolName} Logo`} 
          className="logo-login" 
          style={{ height: 80, width: 80, marginBottom: 16 }} 
        />
        <h2 style={{ margin: 0 }}>Welcome to {settings.schoolName}</h2>
        <p className="muted">Please sign in to continue</p>
      </div>

      {setupComplete && (
        <div style={{ 
          backgroundColor: 'var(--accent-2)', 
          color: 'white', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 24,
          textAlign: 'center'
        }}>
          ✅ Setup completed successfully! You can now log in with your admin credentials.
        </div>
      )}
      <form onSubmit={onSubmit} style={{ display:'grid', gap:12, maxWidth: 320, width: '100%' }}>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" />
        <div style={{ position: 'relative' }}>
          <input 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            placeholder="Password" 
            type={showPassword ? "text" : "password"}
            style={{ paddingRight: '40px', width: '100%' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--muted)',
              fontSize: '14px'
            }}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          Remember me
        </label>
        
        {error && <div style={{ color:'red', textAlign: 'center' }}>{error}</div>}
        <button>Login</button>
      </form>
    </div>
  )
}



