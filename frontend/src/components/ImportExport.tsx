import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportExportService, ImportResult, SystemStats, ImportOptions } from '../services/importExport';

interface ImportExportProps {
  onImportComplete?: (result: ImportResult) => void;
  onExportComplete?: () => void;
}

const ImportExport: React.FC<ImportExportProps> = ({ onImportComplete, onExportComplete }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [showImportOptionsModal, setShowImportOptionsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    clearExisting: false,
    importUsers: true,
    importProgress: true,
    importAssets: true
  });
  
  // Database reset state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  function estimateImportTime(fileSize: number): string {
    // Rough estimation: 1MB per second for processing + network
    const seconds = Math.max(5, Math.ceil(fileSize / (1024 * 1024)));
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m`;
  }

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const systemStats = await ImportExportService.getStats();
      setStats(systemStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleExportComplete = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      setExportProgress(0);
      await ImportExportService.downloadCompleteExport((p: number) => setExportProgress(p));
      setMessage('✅ Complete backup exported successfully! The ZIP file includes all data and assets.');
      await loadStats();
      onExportComplete?.();
    } catch (error) {
      setMessage('❌ Export failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
      setTimeout(() => setExportProgress(0), 800);
    }
  };

  const handleExportJson = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      await ImportExportService.downloadJsonExport();
      setMessage('✅ Data exported successfully! Note: This JSON export does not include uploaded assets.');
      await loadStats();
      onExportComplete?.();
    } catch (error) {
      setMessage('❌ Export failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportClick = async () => {
    try {
      const file = await ImportExportService.loadFile();
      setSelectedFile(file);
      setShowImportOptionsModal(true);
    } catch (error) {
      setMessage('❌ ' + (error as Error).message);
    }
  };

  const handleImportConfirm = async () => {
    if (!selectedFile) return;

    setShowImportOptionsModal(false);
    setIsLoading(true);
    setMessage(null);
    
    try {
      const result = await ImportExportService.importZip(selectedFile, importOptions);
      setImportResult(result);
      setShowImportModal(true);
      await loadStats();
      onImportComplete?.(result);
    } catch (error) {
      setMessage('❌ Import failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportResult(null);
  };

  const resetDatabase = async () => {
    if (resetConfirmation !== 'RESET_DATABASE_CONFIRM' || !resetPassword) {
      return;
    }

    setResetLoading(true);
    try {
      const { api } = await import('../api/client');
      await api.post('/settings/reset-database', {
        confirmation: resetConfirmation,
        adminPassword: resetPassword
      });
      
      // Clear admin authentication state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Trigger a storage event to notify other components
      window.dispatchEvent(new Event('storage'));
      
      // Show success message in popup (not main window)
      setResetMessage('✅ Database reset successfully! Redirecting to setup...');
      
      // Redirect to setup after a brief delay
      setTimeout(() => {
        // Use React Router navigation instead of hard redirect
        navigate('/setup');
      }, 2000);
      
    } catch (error) {
      // Show error message in popup
      setResetMessage('❌ Reset failed: ' + (error as any).response?.data?.error || (error as Error).message);
    } finally {
      setResetLoading(false);
    }
  };

  const closeOptionsModal = () => {
    setShowImportOptionsModal(false);
    setSelectedFile(null);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', color: 'var(--text)' }}>📁 Import/Export System</h2>
      
      {/* System Statistics */}
      {stats && (
        <div style={{
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--panel)',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>📊 Current System State</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.users}</strong>
              <div style={{ color: 'var(--muted)' }}>Users</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.classes}</strong>
              <div style={{ color: 'var(--muted)' }}>Classes</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.lessons}</strong>
              <div style={{ color: 'var(--muted)' }}>Lessons</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.assessments}</strong>
              <div style={{ color: 'var(--muted)' }}>Assessments</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.courses}</strong>
              <div style={{ color: 'var(--muted)' }}>Courses</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.topics}</strong>
              <div style={{ color: 'var(--muted)' }}>Topics</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.assignments}</strong>
              <div style={{ color: 'var(--muted)' }}>Assignments</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.attempts}</strong>
              <div style={{ color: 'var(--muted)' }}>Student Attempts</div>
            </div>
            <div>
              <strong style={{ color: 'var(--accent)' }}>{stats.uploadedFiles}</strong>
              <div style={{ color: 'var(--muted)' }}>Uploaded Files</div>
            </div>
          </div>
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Export Section */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid var(--border)', 
          borderRadius: '8px',
          backgroundColor: 'var(--panel)'
        }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>📤 Export Data</h3>
          <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '14px' }}>
            Create a complete backup of your entire School Master system including all content, users, and uploaded files.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleExportComplete}
              disabled={isLoading}
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: '2px solid var(--accent)',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                fontWeight: '600',
                fontSize: '15px'
              }}
            >
              {isLoading ? `⏳ Creating Export... ${exportProgress}%` : '📦 Complete Backup (ZIP)'}
            </button>
            {isLoading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${exportProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Preparing ZIP... {exportProgress}%</div>
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-8px', paddingLeft: '4px' }}>
              ✓ All content, users, classes, and files
            </div>
            
            <button
              onClick={handleExportJson}
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                fontWeight: '500'
              }}
            >
              💾 Data Only (JSON)
            </button>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-8px', paddingLeft: '4px' }}>
              ⚠️ Does not include uploaded files
            </div>
          </div>
        </div>

        {/* Import Section */}
        <div style={{ 
          padding: '20px', 
          border: '1px solid var(--border)', 
          borderRadius: '8px',
          backgroundColor: 'var(--panel)'
        }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>📥 Import Data</h3>
          <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '14px' }}>
            Restore a complete backup or migrate data from another School Master system.
          </p>
          
          <div style={{
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#856404'
          }}>
            <strong>⚠️ Warning:</strong> Importing will replace existing data. Make sure you have a backup!
          </div>
          
          <button
            onClick={handleImportClick}
            disabled={isLoading}
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--accent-2)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontWeight: '600',
              fontSize: '15px',
              width: '100%'
            }}
          >
            {isLoading ? '⏳ Importing...' : '📁 Import Complete Backup'}
          </button>
        </div>

        {/* Database Reset Section */}
        <div style={{ 
          padding: '20px', 
          border: '2px solid var(--danger)', 
          borderRadius: '8px',
          backgroundColor: 'var(--danger-light)',
          gridColumn: '1 / -1'
        }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--danger-dark)' }}>⚠️ Danger Zone - Database Reset</h3>
          <p style={{ marginBottom: '16px', color: 'var(--danger-dark)', fontSize: '14px' }}>
            This will permanently delete ALL data and reset the system back to the initial setup screen.
            This action cannot be undone!
          </p>
          
          <div style={{
            padding: '12px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#721c24'
          }}>
            <strong>🚨 WARNING:</strong> This will delete:
            <ul style={{ margin: '8px 0 0 20px' }}>
              <li>All users (admin, teachers, students)</li>
              <li>All lessons, assessments, and courses</li>
              <li>All classes and assignments</li>
              <li>All uploaded files and assets</li>
              <li>All settings and configuration</li>
            </ul>
          </div>
          
          <button
            onClick={() => setShowResetDialog(true)}
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '15px'
            }}
          >
            🗑️ Reset Database
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div style={{ 
          marginTop: '20px',
          padding: '12px 16px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}

      {/* Import Options Modal */}
      {showImportOptionsModal && selectedFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>⚙️ Import Options</h3>
            
            <p style={{ marginBottom: '16px', color: 'var(--text)' }}>
              File: <strong>{selectedFile.name}</strong>
              <br />
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Est. time: {estimateImportTime(selectedFile.size)}
              </span>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '10px',
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
                padding: '10px'
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
                padding: '10px'
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
                padding: '10px'
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeOptionsModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--panel)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportConfirm}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {importOptions.clearExisting ? '⚠️ Clear & Import' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Results Modal */}
      {showImportModal && importResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>
              {importResult.success ? '✅ Import Successful' : '⚠️ Import Completed with Errors'}
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'var(--text)', marginBottom: '12px' }}>{importResult.message}</p>
              
              <div style={{ 
                backgroundColor: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '6px',
                marginBottom: '12px'
              }}>
                <h4 style={{ marginBottom: '12px', color: 'var(--text)' }}>📋 Imported Items:</h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px',
                  fontSize: '14px'
                }}>
                  <div><strong>Settings:</strong> {importResult.imported.settings}</div>
                  <div><strong>Users:</strong> {importResult.imported.users}</div>
                  <div><strong>Classes:</strong> {importResult.imported.classes}</div>
                  <div><strong>Lessons:</strong> {importResult.imported.lessons}</div>
                  <div><strong>Assessments:</strong> {importResult.imported.assessments}</div>
                  <div><strong>Courses:</strong> {importResult.imported.courses}</div>
                  <div><strong>Topics:</strong> {importResult.imported.topics}</div>
                  <div><strong>Assignments:</strong> {importResult.imported.assignments}</div>
                  <div><strong>Course Assigns:</strong> {importResult.imported.courseAssignments}</div>
                  <div><strong>Topic Assigns:</strong> {importResult.imported.topicAssignments}</div>
                  <div><strong>Attempts:</strong> {importResult.imported.attempts}</div>
                  <div><strong>Assets:</strong> {importResult.imported.assets}</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div style={{ 
                  backgroundColor: '#f8d7da', 
                  padding: '12px', 
                  borderRadius: '6px',
                  border: '1px solid #f5c6cb'
                }}>
                  <h4 style={{ marginBottom: '8px', color: '#721c24' }}>Errors ({importResult.errors.length}):</h4>
                  <div style={{ 
                    maxHeight: '200px', 
                    overflow: 'auto',
                    fontSize: '13px'
                  }}>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#721c24' }}>
                    {importResult.errors.map((error, index) => (
                        <li key={index} style={{ marginBottom: '4px' }}>{error}</li>
                    ))}
                  </ul>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={closeImportModal}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                width: '100%'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Database Reset Dialog */}
      {showResetDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            padding: '30px', 
            border: '2px solid var(--danger)', 
            borderRadius: '12px',
            backgroundColor: 'var(--panel)',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--danger-dark)', fontSize: '24px' }}>
              🚨 Reset Database
            </h3>
            
            <div style={{
              padding: '16px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, color: '#721c24', fontWeight: '600' }}>
                This action will permanently delete ALL data and cannot be undone!
              </p>
            </div>

            <p style={{ marginBottom: '20px', color: 'var(--text)' }}>
              To confirm this action, please:
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                1. Type "RESET_DATABASE_CONFIRM" exactly:
              </label>
              <input
                type="text"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET_DATABASE_CONFIRM"
                style={{ 
                  width: '100%',
                  padding: '12px',
                  border: '2px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
                2. Enter your admin password:
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Admin password"
                style={{ 
                  width: '100%',
                  padding: '12px',
                  border: '2px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {/* Reset Message Display */}
            {resetMessage && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: resetMessage.includes('✅') ? '#d4edda' : '#f8d7da',
                color: resetMessage.includes('✅') ? '#155724' : '#721c24',
                border: `1px solid ${resetMessage.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {resetMessage}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowResetDialog(false);
                  setResetConfirmation('');
                  setResetPassword('');
                  setResetMessage(null);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--panel)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={resetDatabase}
                disabled={resetLoading || resetConfirmation !== 'RESET_DATABASE_CONFIRM' || !resetPassword}
                style={{ 
                  padding: '12px 24px',
                  backgroundColor: 'var(--danger)', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (resetLoading || resetConfirmation !== 'RESET_DATABASE_CONFIRM' || !resetPassword) ? 'not-allowed' : 'pointer',
                  opacity: (resetLoading || resetConfirmation !== 'RESET_DATABASE_CONFIRM' || !resetPassword) ? 0.5 : 1,
                  fontWeight: '600'
                }}
              >
                {resetLoading ? 'Resetting...' : '🗑️ Reset Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExport;