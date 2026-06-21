import React from 'react';
import { 
  BookOpen, 
  Home, 
  HardDrive, 
  Sun, 
  Moon, 
  LogOut,
  Lock
} from 'lucide-react';
import type { User } from '../services/authService';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  storageStats: { used: number; limit: number; percent: number };
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  storageStats,
  theme,
  toggleTheme,
  user,
  onLogout
}) => {
  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <BookOpen className="brand-icon" size={24} />
          <span>Library</span>
        </div>

        <nav className="sidebar-nav">
          <button 
            onClick={() => onViewChange('dashboard')}
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          >
            <Home size={20} />
            <span>Dashboard</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {/* Storage Widget */}
          <div className="storage-widget">
            <div className="storage-header">
              <div className="storage-title">
                <HardDrive size={16} />
                <span>Private Cloud Storage</span>
              </div>
              <span className="storage-text">{storageStats.percent.toFixed(1)}%</span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${storageStats.percent}%` }}
              ></div>
            </div>
            <div className="storage-details">
              <span>{formatBytes(storageStats.used)} used</span>
              <span>{formatBytes(storageStats.limit, 0)} limit</span>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="privacy-badge">
            <Lock size={14} className="privacy-icon" />
            <span>Private by default. Only you can access your books.</span>
          </div>

          <hr className="divider" />

          {/* User Session & Theme Toggler */}
          <div className="user-profile-section">
            <div className="user-info">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="user-avatar" />
              ) : (
                <div className="user-avatar-fallback">{user?.name[0]}</div>
              )}
              <div className="user-meta">
                <span className="user-name">{user?.name || 'Guest User'}</span>
                <span className="user-role">Personal Bookshelf</span>
              </div>
            </div>

            <div className="footer-actions">
              <button 
                onClick={toggleTheme} 
                className="action-btn"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              
              <button 
                onClick={onLogout} 
                className="action-btn logout-btn"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation & Header */}
      <div className="mobile-header">
        <div className="mobile-brand">
          <BookOpen className="brand-icon" size={20} />
          <span>Library</span>
        </div>
        <div className="mobile-header-actions">
          <button onClick={toggleTheme} className="action-btn">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button onClick={onLogout} className="action-btn" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <nav className="mobile-bottom-nav">
        <button 
          onClick={() => onViewChange('dashboard')}
          className={`mobile-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
        >
          <Home size={20} />
          <span>Dashboard</span>
        </button>
      </nav>

      {/* Additional CSS specifically for Sidebar navigation layout since it's highly component-dependent */}
      <style>{`
        /* Desktop Sidebar Styles */
        .desktop-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 280px;
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 2rem 1.5rem;
          z-index: 100;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 1.5rem;
          color: var(--text-primary);
          margin-bottom: 2.5rem;
        }

        .brand-icon {
          color: var(--accent);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 1rem;
          width: 100%;
          text-align: left;
          transition: all var(--transition-fast);
        }

        .nav-item:hover {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        .nav-item.active {
          background-color: var(--accent-light);
          color: var(--accent);
        }

        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Storage Widget */
        .storage-widget {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem;
        }

        .storage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
        }

        .storage-title {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .storage-text {
          color: var(--text-secondary);
          font-weight: 600;
        }

        .progress-bar-container {
          height: 6px;
          background-color: var(--border-color);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-bar-fill {
          height: 100%;
          background-color: var(--accent);
          border-radius: var(--radius-full);
          transition: width var(--transition-normal);
        }

        .storage-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        /* Privacy Badge */
        .privacy-badge {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          line-height: 1.3;
          color: var(--text-secondary);
        }

        .privacy-icon {
          color: var(--accent);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .divider {
          border: 0;
          height: 1px;
          background-color: var(--border-color);
          margin: 0.5rem 0;
        }

        /* User Profile Section */
        .user-profile-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          object-fit: cover;
          border: 2px solid var(--border-color);
        }

        .user-avatar-fallback {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          background-color: var(--accent-light);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          overflow: hidden;
        }

        .user-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .footer-actions {
          display: flex;
          gap: 0.25rem;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }

        .action-btn:hover {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        .logout-btn:hover {
          color: #EF4444; /* Alert Color */
        }

        /* Mobile Layout Styling */
        .mobile-header {
          display: none;
        }

        .mobile-bottom-nav {
          display: none;
        }

        @media (max-width: 1024px) {
          .desktop-sidebar {
            display: none;
          }

          .mobile-header {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            align-items: center;
            justify-content: space-between;
            padding: 0 1rem;
            z-index: 100;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 700;
            font-size: 1.2rem;
          }

          .mobile-header-actions {
            display: flex;
            gap: 0.5rem;
          }

          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background-color: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
            align-items: center;
            justify-content: space-around;
            z-index: 100;
            padding-bottom: env(safe-area-inset-bottom);
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            color: var(--text-secondary);
            font-size: 0.75rem;
            width: 100%;
            height: 100%;
          }

          .mobile-nav-item.active {
            color: var(--accent);
          }
        }
      `}</style>
    </>
  );
};
