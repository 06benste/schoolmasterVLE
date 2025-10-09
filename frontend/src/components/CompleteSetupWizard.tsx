import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ImportExportService, ImportResult } from '../services/importExport';

export default function CompleteSetupWizard() {
  const [step, setStep] = useState(1);
  const [setupType, setSetupType] = useState<'new' | 'restore' | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState({
    clearExisting: true,
    importUsers: true,
    importProgress: true,
    importAssets: true
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if setup is already complete
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    try {
      const response = await api.get('/settings/setup-status');
      if (response.data.isSetupComplete) {
        navigate('/login?setup=complete');
      }
    } catch (err) {
      // If we can't check status, continue with setup
      console.log('Could not check setup status, continuing with setup');
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleBackupChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setBackupFile(file);
    }
  }

  function estimateImportTime(fileSize: number): string {
    // Rough estimation: 1MB per second for processing + network
    const seconds = Math.max(5, Math.ceil(fileSize / (1024 * 1024)));
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m`;
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return null;

    const formData = new FormData();
    formData.append('file', logoFile);

    try {
      const response = await api.post('/uploads/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data.filename;
    } catch (err) {
      console.error('Logo upload failed:', err);
      return null;
    }
  }

  async function completeSetup() {
    setError(null);
    setLoading(true);

    try {
      if (setupType === 'new') {
        // Validate inputs for new setup
      if (!schoolName.trim()) {
        throw new Error('School name is required');
      }
      if (!adminPassword) {
        throw new Error('Admin password is required');
      }
      if (adminPassword.length < 8) {
        throw new Error('Admin password must be at least 8 characters long');
      }
      if (adminPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Upload logo if provided
      let logoFilename = null;
      if (logoFile) {
        logoFilename = await uploadLogo();
      }

      // Complete setup
      await api.post('/settings/complete-setup', {
        schoolName: schoolName.trim(),
        adminPassword,
        logoFile: logoFilename
      });

      // Verify setup is complete
      const setupStatus = await api.get('/settings/setup-status');
      console.log('✅ Setup completed, status:', setupStatus.data);
      } else if (setupType === 'restore') {
        // Validate backup file
        if (!backupFile) {
          throw new Error('Please select a backup file');
        }

        // Import the backup
        const result = await ImportExportService.importZip(backupFile, importOptions);
        setImportResult(result);
        
        if (!result.success) {
          throw new Error(`Import failed: ${result.message}`);
        }

        // After successful restore, verify that school_name exists in settings
        // If not, the setup won't be marked as complete and we'll have redirect issues
        try {
          const setupStatus = await api.get('/settings/setup-status');
          if (!setupStatus.data.hasSchoolName) {
            // Backup didn't contain school_name, set a default
            console.log('⚠️ Restored backup missing school_name, setting default...');
            await api.put('/settings', { school_name: 'Restored School' });
          }
        } catch (err) {
          console.error('Failed to verify setup status after restore:', err);
          // Continue anyway, the restore was successful
        }
      }

      // Clear any existing authentication state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Trigger a storage event to notify SchoolProvider of the change
      window.dispatchEvent(new Event('storage'));
      
      // Force a longer delay to ensure database writes complete
      // Use base URL from env to ensure it works with any deployment path
      const baseUrl = (import.meta as any).env.BASE_URL || '/';
      setTimeout(() => {
        window.location.href = `${baseUrl}login?setup=complete`;
      }, 500);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--bg)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 20
    }}>
      <div className="card" style={{ 
        maxWidth: 600, 
        width: '100%', 
        padding: 40,
        textAlign: 'center'
      }}>
        <h1 style={{ color: 'var(--accent)', marginBottom: 8 }}>
          🎓 School Master Setup
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: 32 }}>
          Welcome! Let's set up your School Virtual Learning Environment.
        </p>

        {step === 1 && (
          <div>
            <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>Choose Setup Type</h2>
            
            <div style={{ 
              display: 'grid', 
              gap: '16px', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setSetupType('new')}
                style={{
                  padding: '20px',
                  border: setupType === 'new' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: setupType === 'new' ? 'var(--accent-light)' : 'var(--panel)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🆕</div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>New School</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  Set up a fresh School Master system
                </div>
              </button>

              <button
                onClick={() => setSetupType('restore')}
                style={{
                  padding: '20px',
                  border: setupType === 'restore' ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: setupType === 'restore' ? 'var(--accent-light)' : 'var(--panel)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Restore Backup</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                  Restore from a previous backup
                </div>
              </button>
            </div>

            <button 
              onClick={() => setStep(2)}
              disabled={!setupType}
              style={{ 
                padding: '12px 32px', 
                fontSize: '16px',
                opacity: !setupType ? 0.5 : 1
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && setupType === 'restore' && (
          <div>
            <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>Restore from Backup</h2>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text)', fontWeight: '500' }}>
                Select Backup File *
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={handleBackupChange}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: 4 }}>
                Select a School Master backup ZIP file
              </div>
            </div>

            {backupFile && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--accent-light)',
                border: '1px solid var(--accent)',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <div style={{ fontWeight: '600', color: 'var(--accent-dark)' }}>Selected File:</div>
                <div style={{ fontSize: '14px', color: 'var(--text)' }}>{backupFile.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Size: {(backupFile.size / 1024 / 1024).toFixed(2)} MB • Est. time: {estimateImportTime(backupFile.size)}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: 'var(--text)', marginBottom: 12 }}>Import Options</h4>
              
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '8px',
                backgroundColor: importOptions.clearExisting ? '#fff3cd' : 'transparent',
                borderRadius: '6px',
                border: importOptions.clearExisting ? '1px solid #ffc107' : '1px solid transparent'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.clearExisting}
                  onChange={(e) => setImportOptions({ ...importOptions, clearExisting: e.target.checked })}
                  style={{ marginRight: '10px', width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>Clear Existing Data</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>⚠️ Delete all current data before importing</div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '8px'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importUsers}
                  onChange={(e) => setImportOptions({ ...importOptions, importUsers: e.target.checked })}
                  style={{ marginRight: '10px', width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>Import Users</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Include user accounts and passwords</div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '8px'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importProgress}
                  onChange={(e) => setImportOptions({ ...importOptions, importProgress: e.target.checked })}
                  style={{ marginRight: '10px', width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>Import Student Progress</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Include attempts, scores, and progress</div>
                </div>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '8px'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importAssets}
                  onChange={(e) => setImportOptions({ ...importOptions, importAssets: e.target.checked })}
                  style={{ marginRight: '10px', width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text)' }}>Import Uploaded Files</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Include images, videos, and documents</div>
                </div>
              </label>
            </div>

            <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
              <button 
                onClick={() => setStep(1)}
                className="secondary"
              >
                Back
              </button>
              <button 
                onClick={completeSetup}
                disabled={loading || !backupFile}
                style={{ 
                  opacity: (loading || !backupFile) ? 0.5 : 1,
                  backgroundColor: 'var(--accent-2)'
                }}
              >
                {loading ? 'Restoring...' : 'Restore & Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && setupType === 'new' && (
          <div>
            <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>Step 1: School Information</h2>
            
            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text)', fontWeight: '500' }}>
                School Name *
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Enter your school name"
                style={{ width: '100%' }}
                autoFocus
              />
              <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: 4 }}>
                This will be used throughout the system
              </div>
            </div>

            <button 
              onClick={() => setStep(3)}
              disabled={!schoolName.trim()}
              style={{ 
                padding: '12px 32px', 
                fontSize: '16px',
                opacity: !schoolName.trim() ? 0.5 : 1
              }}
            >
              Next: Admin Password
            </button>
          </div>
        )}

        {step === 3 && setupType === 'new' && (
          <div>
            <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>Step 2: Admin Password</h2>
            
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text)', fontWeight: '500' }}>
                Admin Password *
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                style={{ width: '100%' }}
                autoFocus
              />
              <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: 4 }}>
                Minimum 8 characters
              </div>
            </div>

            <div style={{ marginBottom: 24, textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text)', fontWeight: '500' }}>
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm admin password"
                style={{ width: '100%' }}
              />
            </div>

            <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
              <button 
                onClick={() => setStep(2)}
                className="secondary"
              >
                Back
              </button>
              <button 
                onClick={() => setStep(4)}
                disabled={!adminPassword || adminPassword.length < 8 || adminPassword !== confirmPassword}
                style={{ 
                  opacity: (!adminPassword || adminPassword.length < 8 || adminPassword !== confirmPassword) ? 0.5 : 1
                }}
              >
                Next: School Logo
              </button>
            </div>
          </div>
        )}

        {step === 4 && setupType === 'new' && (
          <div>
            <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>Step 3: School Logo (Optional)</h2>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text)', fontWeight: '500' }}>
                Upload School Logo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '0.9em', color: 'var(--muted)', marginTop: 4 }}>
                Recommended: PNG or JPG, max 2MB
              </div>
            </div>

            {logoPreview && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.9em', color: 'var(--text)', marginBottom: 8 }}>Preview:</div>
                <img 
                  src={logoPreview} 
                  alt="Logo preview" 
                  style={{ 
                    maxWidth: 200, 
                    maxHeight: 100, 
                    border: '1px solid var(--border)',
                    borderRadius: 8
                  }} 
                />
              </div>
            )}

            <div className="row" style={{ gap: 12, justifyContent: 'center' }}>
              <button 
                onClick={() => setStep(3)}
                className="secondary"
              >
                Back
              </button>
              <button 
                onClick={completeSetup}
                disabled={loading}
                style={{ 
                  opacity: loading ? 0.5 : 1,
                  backgroundColor: 'var(--accent-2)'
                }}
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="card" style={{
            backgroundColor: 'var(--danger)',
            color: 'white',
            marginTop: 24,
            padding: 16
          }}>
            {error}
          </div>
        )}

        {importResult && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: importResult.success ? '#d4edda' : '#f8d7da',
            color: importResult.success ? '#155724' : '#721c24',
            border: `1px solid ${importResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            <h4 style={{ marginBottom: '8px' }}>
              {importResult.success ? '✅ Restore Successful' : '⚠️ Restore Completed with Errors'}
            </h4>
            <p style={{ marginBottom: '12px' }}>{importResult.message}</p>
            
            <div style={{ 
              backgroundColor: 'var(--bg)', 
              padding: '12px', 
              borderRadius: '6px',
              marginBottom: '12px'
            }}>
              <h5 style={{ marginBottom: '8px' }}>Imported Items:</h5>
              <div style={{ fontSize: '13px' }}>
                Users: {importResult.imported.users} | 
                Classes: {importResult.imported.classes} | 
                Lessons: {importResult.imported.lessons} | 
                Assessments: {importResult.imported.assessments} | 
                Courses: {importResult.imported.courses} | 
                Topics: {importResult.imported.topics} | 
                Assignments: {importResult.imported.assignments} | 
                Assets: {importResult.imported.assets}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <h5 style={{ marginBottom: '8px' }}>Errors ({importResult.errors.length}):</h5>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                  {importResult.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>... and {importResult.errors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: '0.9em', color: 'var(--muted)' }}>
          {setupType === 'new' ? `Step ${step} of 4` : setupType === 'restore' ? 'Restore Setup' : 'Step 1 of 1'}
        </div>
      </div>
    </div>
  );
}
