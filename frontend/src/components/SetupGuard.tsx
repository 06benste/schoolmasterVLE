import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';

interface SetupGuardProps {
  children: React.ReactNode;
}

export default function SetupGuard({ children }: SetupGuardProps) {
  console.log('🛡️ SetupGuard component rendering...')
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    console.log('🔍 SetupGuard useEffect running...')
    // Add a small delay to ensure any setup completion has time to propagate
    const timer = setTimeout(() => {
      checkSetupStatus();
    }, 200);
    
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  async function checkSetupStatus() {
    console.log('🔍 Checking setup status...')
    
    // Don't check setup status if we're on login page with setup=complete
    if (location.pathname === '/login' && location.search.includes('setup=complete')) {
      console.log('✅ Already on login page after setup completion, skipping status check')
      setIsSetupComplete(true);
      setLoading(false);
      return;
    }
    
    // Don't check setup status if we're on the setup page itself
    if (location.pathname === '/setup') {
      console.log('✅ On setup page, skipping status check')
      setIsSetupComplete(false);
      setLoading(false);
      return;
    }
    
    try {
      const response = await api.get('/settings/setup-status');
      console.log('📊 Setup status response:', response.data)
      console.log('📊 Setup complete check:', {
        isSetupComplete: response.data.isSetupComplete,
        hasSchoolName: response.data.hasSchoolName,
        hasAdminUser: response.data.hasAdminUser
      });
      setIsSetupComplete(response.data.isSetupComplete);
    } catch (err) {
      console.log('ℹ️ Setup status check failed (normal during initial setup):', err)
      // If we can't check status, assume setup is needed
      setIsSetupComplete(false);
    } finally {
      console.log('✅ Setup status check complete, loading:', false)
      setLoading(false);
    }
  }

  console.log('🔄 SetupGuard render state:', { loading, isSetupComplete })

  if (loading) {
    console.log('⏳ SetupGuard showing loading screen')
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'var(--bg)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center', color: 'var(--text)' }}>
          <div style={{ fontSize: '2em', marginBottom: 16 }}>🎓</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    // Only redirect if we're not already on the setup page
    if (location.pathname !== '/setup') {
      console.log('🔄 SetupGuard redirecting to /setup')
      return <Navigate to="/setup" replace />;
    } else {
      console.log('✅ SetupGuard allowing setup page to render')
      return <>{children}</>;
    }
  }

  console.log('✅ SetupGuard rendering children')
  return <>{children}</>;
}
