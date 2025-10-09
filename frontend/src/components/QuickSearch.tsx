import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface SearchResult {
  id: string;
  title: string;
  type: 'user' | 'class' | 'lesson' | 'assessment' | 'course' | 'topic';
  subtitle?: string;
  route: string;
}

export default function QuickSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      if (isOpen) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setQuery('');
          setResults([]);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (results[selectedIndex]) {
            navigate(results[selectedIndex].route);
            setIsOpen(false);
            setQuery('');
            setResults([]);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search function
  const search = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [usersRes, classesRes, lessonsRes, assessmentsRes, coursesRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/classes').catch(() => ({ data: [] })),
        api.get('/lessons').catch(() => ({ data: [] })),
        api.get('/assessments').catch(() => ({ data: [] })),
        api.get('/curriculum/courses').catch(() => ({ data: [] }))
      ]);

      const allResults: SearchResult[] = [];

      // Search users
      usersRes.data.forEach((user: any) => {
        if (user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.username?.toLowerCase().includes(searchQuery.toLowerCase())) {
          allResults.push({
            id: user.id,
            title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
            type: 'user',
            subtitle: user.email,
            route: '/admin/users'
          });
        }
      });

      // Search classes
      classesRes.data.forEach((cls: any) => {
        if (cls.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
          allResults.push({
            id: cls.id,
            title: cls.name,
            type: 'class',
            subtitle: `Class`,
            route: '/classes'
          });
        }
      });

      // Search lessons
      lessonsRes.data.forEach((lesson: any) => {
        if (lesson.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
          allResults.push({
            id: lesson.id,
            title: lesson.title,
            type: 'lesson',
            subtitle: 'Lesson',
            route: '/admin/lessons'
          });
        }
      });

      // Search assessments
      assessmentsRes.data.forEach((assessment: any) => {
        if (assessment.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
          allResults.push({
            id: assessment.id,
            title: assessment.title,
            type: 'assessment',
            subtitle: 'Assessment',
            route: '/admin/assessments'
          });
        }
      });

      // Search courses
      coursesRes.data.forEach((course: any) => {
        if (course.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
          allResults.push({
            id: course.id,
            title: course.title,
            type: 'course',
            subtitle: 'Course',
            route: '/admin/courses'
          });
        }
      });

      // Add system status if searching for system/status/health
      if (searchQuery.toLowerCase().includes('system') || 
          searchQuery.toLowerCase().includes('status') || 
          searchQuery.toLowerCase().includes('health')) {
        allResults.push({
          id: 'system-status',
          title: 'System Status',
          type: 'course',
          subtitle: 'Health & Performance',
          route: '/admin/status'
        });
      }

      setResults(allResults.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '10vh',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '70vh',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
      }}>
        {/* Search Input */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search users, classes, lessons, assessments, courses..."
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)'
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
              No results found for "{query}"
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
              Start typing to search...
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}`}
              onClick={() => {
                navigate(result.route);
                setIsOpen(false);
                setQuery('');
                setResults([]);
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? 'var(--accent-light)' : 'transparent',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {result.type === 'user' && '👤'}
                {result.type === 'class' && '🏫'}
                {result.type === 'lesson' && '📚'}
                {result.type === 'assessment' && '📝'}
                {result.type === 'course' && '🎯'}
                {result.type === 'topic' && '📋'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                  {result.title}
                </div>
                {result.subtitle && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {result.subtitle}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--muted)',
                textTransform: 'capitalize'
              }}>
                {result.type}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
          fontSize: '12px',
          color: 'var(--muted)',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>↑↓ Navigate • Enter Select • Esc Close</span>
          <span>Ctrl+K to open</span>
        </div>
      </div>
    </div>
  );
}