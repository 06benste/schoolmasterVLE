import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface SchoolSettings {
  schoolName: string;
  schoolLogo?: string;
}

interface SchoolContextType {
  settings: SchoolSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
  console.log('🏫 SchoolProvider component rendering...')
  const [settings, setSettings] = useState<SchoolSettings>({ schoolName: 'School Master' });
  const [loading, setLoading] = useState(true);

  async function refreshSettings() {
    console.log('🔍 SchoolProvider refreshing settings...')
    try {
      // Check if user is logged in before trying to fetch settings
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('ℹ️ No auth token, skipping settings fetch');
        setLoading(false);
        return;
      }
      
      const response = await api.get('/settings');
      console.log('✅ School settings loaded:', response.data)
      setSettings({
        schoolName: response.data.school_name || 'School Master',
        schoolLogo: response.data.school_logo
      });
    } catch (err) {
      // This is normal during setup or when not authenticated - don't log as error
      console.log('ℹ️ Settings not available yet (normal during setup or when not logged in)');
    } finally {
      console.log('✅ SchoolProvider settings refresh complete')
      setLoading(false);
    }
  }

  useEffect(() => {
    console.log('🔍 SchoolProvider useEffect running...')
    refreshSettings();
  }, []);

  // Listen for storage changes to refresh settings when user logs in
  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('token');
      if (token) {
        refreshSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <SchoolContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}
