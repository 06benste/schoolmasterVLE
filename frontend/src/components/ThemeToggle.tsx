import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { theme, actualTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') return '🖥️';
    return actualTheme === 'dark' ? '🌙' : '☀️';
  };

  const getTooltip = () => {
    if (theme === 'system') return 'System theme (click to cycle)';
    if (theme === 'dark') return 'Dark theme (click to cycle)';
    return 'Light theme (click to cycle)';
  };

  return (
    <button
      onClick={toggleTheme}
      title={getTooltip()}
      style={{
        background: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        backgroundColor: 'var(--panel)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        minWidth: '40px',
        minHeight: '40px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--accent)';
        e.currentTarget.style.color = 'white';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--panel)';
        e.currentTarget.style.color = 'var(--text)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {getIcon()}
    </button>
  );
};

export default ThemeToggle;
