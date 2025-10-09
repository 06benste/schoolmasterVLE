import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime?: number;
  directoryExists?: boolean;
  writable?: boolean;
  fileCount?: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTime: number;
  checks: {
    database: HealthCheck;
    uploads: HealthCheck;
    system: HealthCheck;
  };
}

interface DetailedStatus {
  timestamp: string;
  database: {
    users: number;
    classes: number;
    lessons: number;
    assessments: number;
    courses: number;
    topics: number;
    assignments: number;
    attempts: number;
  };
  uploads: {
    exists: boolean;
    writable: boolean;
    fileCount: number;
    totalSize: number;
  };
  system: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
  };
}

export default function SystemStatus() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [detailedStatus, setDetailedStatus] = useState<DetailedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadHealthStatus = async () => {
    try {
      const response = await api.get('/status/health');
      setHealthStatus(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load health status: ' + (err.response?.data?.message || err.message));
    }
  };

  const loadDetailedStatus = async () => {
    try {
      const response = await api.get('/status/status');
      setDetailedStatus(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load detailed status: ' + (err.response?.data?.message || err.message));
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([loadHealthStatus(), loadDetailedStatus()]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'degraded': return '#ffc107';
      case 'unhealthy': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading && !healthStatus) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: 'var(--muted)' }}>Loading system status...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--text)' }}>🔧 System Status</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {lastRefresh && (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={refreshAll}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Overall Health Status */}
      {healthStatus && (
        <div style={{
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--panel)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '24px' }}>
              {getStatusIcon(healthStatus.status)}
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>
                Overall System Health: <span style={{ color: getStatusColor(healthStatus.status) }}>
                  {healthStatus.status.toUpperCase()}
                </span>
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Response time: {healthStatus.responseTime}ms • Checked: {new Date(healthStatus.timestamp).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {/* Database Check */}
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg)',
              borderRadius: '6px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>{getStatusIcon(healthStatus.checks.database.status)}</span>
                <strong style={{ color: 'var(--text)' }}>Database</strong>
                <span style={{ 
                  color: getStatusColor(healthStatus.checks.database.status),
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {healthStatus.checks.database.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {healthStatus.checks.database.message}
                {healthStatus.checks.database.responseTime && (
                  <span> • {healthStatus.checks.database.responseTime}ms</span>
                )}
              </div>
            </div>

            {/* Uploads Check */}
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg)',
              borderRadius: '6px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>{getStatusIcon(healthStatus.checks.uploads.status)}</span>
                <strong style={{ color: 'var(--text)' }}>Uploads Directory</strong>
                <span style={{ 
                  color: getStatusColor(healthStatus.checks.uploads.status),
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {healthStatus.checks.uploads.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {healthStatus.checks.uploads.message}
                {healthStatus.checks.uploads.fileCount !== undefined && (
                  <span> • {healthStatus.checks.uploads.fileCount} files</span>
                )}
              </div>
            </div>

            {/* System Check */}
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg)',
              borderRadius: '6px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>{getStatusIcon(healthStatus.checks.system.status)}</span>
                <strong style={{ color: 'var(--text)' }}>System Resources</strong>
                <span style={{ 
                  color: getStatusColor(healthStatus.checks.system.status),
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {healthStatus.checks.system.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {healthStatus.checks.system.message}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Status */}
      {detailedStatus && (
        <div style={{
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          backgroundColor: 'var(--panel)'
        }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text)' }}>📊 Detailed System Information</h3>
          
          <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {/* Database Statistics */}
            <div>
              <h4 style={{ marginBottom: '12px', color: 'var(--text)' }}>🗄️ Database</h4>
              <div style={{ 
                backgroundColor: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Users:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.users}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Classes:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.classes}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Lessons:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.lessons}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Assessments:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.assessments}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Courses:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.courses}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Topics:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.topics}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Assignments:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.assignments}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Student Attempts:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.database.attempts}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Uploads Information */}
            <div>
              <h4 style={{ marginBottom: '12px', color: 'var(--text)' }}>📁 Uploads</h4>
              <div style={{ 
                backgroundColor: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Directory Exists:</span>
                    <strong style={{ color: detailedStatus.uploads.exists ? 'var(--success)' : 'var(--error)' }}>
                      {detailedStatus.uploads.exists ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Writable:</span>
                    <strong style={{ color: detailedStatus.uploads.writable ? 'var(--success)' : 'var(--error)' }}>
                      {detailedStatus.uploads.writable ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>File Count:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.uploads.fileCount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Total Size:</span>
                    <strong style={{ color: 'var(--text)' }}>{formatBytes(detailedStatus.uploads.totalSize)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* System Information */}
            <div>
              <h4 style={{ marginBottom: '12px', color: 'var(--text)' }}>💻 System</h4>
              <div style={{ 
                backgroundColor: 'var(--bg)', 
                padding: '16px', 
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Uptime:</span>
                    <strong style={{ color: 'var(--text)' }}>{formatUptime(detailedStatus.system.uptime)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Memory Used:</span>
                    <strong style={{ color: 'var(--text)' }}>{formatBytes(detailedStatus.system.memoryUsage.heapUsed)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Memory Total:</span>
                    <strong style={{ color: 'var(--text)' }}>{formatBytes(detailedStatus.system.memoryUsage.heapTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Node Version:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.system.nodeVersion}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Platform:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.system.platform} {detailedStatus.system.arch}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Process ID:</span>
                    <strong style={{ color: 'var(--text)' }}>{detailedStatus.system.pid}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
