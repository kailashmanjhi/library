import { useState, useEffect } from 'react';
import { authService } from './services/authService';
import type { User } from './services/authService';
import { metadataService } from './services/metadataService';
import type { Book } from './services/metadataService';
import { progressService } from './services/progressService';
import type { ReadingProgress } from './services/progressService';
import { storageService } from './services/storageService';
import { coverService } from './services/coverService';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { UploadModal } from './components/UploadModal';
import { BookDetailsModal } from './components/BookDetailsModal';
import { EpubReader } from './components/EpubReader';
import { PdfReader } from './components/PdfReader';
import { BookOpen, Shield, Lock, Loader2 } from 'lucide-react';

function App() {
  // Auth Session State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // App State
  const [books, setBooks] = useState<Book[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [storageStats, setStorageStats] = useState({ used: 0, limit: 5 * 1024 * 1024 * 1024, percent: 0 });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [refreshingCovers, setRefreshingCovers] = useState(false);

  // Navigation / Modal States
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // 1. Initial User Session & Theme Sync
  useEffect(() => {
    // Check user session
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setAuthLoading(false);

    // Sync theme
    const savedTheme = localStorage.getItem('library_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // 2. Fetch Data once User is authenticated
  useEffect(() => {
    if (!user) return;
    refreshLibraryData();
  }, [user]);

  const loadBookCovers = async (allBooks: Book[]) => {
    const newCoversMap: Record<string, string> = {};
    for (const book of allBooks) {
      if (book.hasCover) {
        try {
          const coverUrl = await storageService.getBookCoverUrl(book.id);
          if (coverUrl) {
            newCoversMap[book.id] = coverUrl;
          }
        } catch (e) {
          console.warn(`Failed to load cover for ${book.title}:`, e);
        }
      }
    }
    
    // Revoke old cover URLs that are no longer present
    Object.keys(covers).forEach(id => {
      if (!newCoversMap[id] && covers[id]) {
        storageService.revokeBookUrl(covers[id]);
      }
    });

    setCovers(newCoversMap);
  };

  const refreshLibraryData = () => {
    // Load books
    const allBooks = metadataService.getBooks();
    setBooks(allBooks);

    // Load progress
    const progressList = progressService.getAllProgress();
    const map: Record<string, ReadingProgress> = {};
    progressList.forEach(p => {
      map[p.bookId] = p;
    });
    setProgressMap(map);

    // Load storage stats
    const stats = metadataService.getStorageStats();
    setStorageStats(stats);

    // Load covers asynchronously
    loadBookCovers(allBooks);
  };

  // Legacy Book Cover Extraction Refresh Helper
  const handleRefreshCovers = async () => {
    setRefreshingCovers(true);
    const allBooks = metadataService.getBooks();
    let updatedAny = false;

    for (const book of allBooks) {
      // If book does not have hasCover flag set, or cover is missing
      if (book.hasCover === undefined || !covers[book.id]) {
        try {
          const fileBlob = await storageService.getBookFile(book.id);
          if (fileBlob) {
            const fileBuffer = await fileBlob.arrayBuffer();
            let coverBlob: Blob | null = null;
            
            if (book.format === 'epub') {
              coverBlob = await coverService.extractEpubCover(fileBuffer);
            } else if (book.format === 'pdf') {
              coverBlob = await coverService.extractPdfCover(fileBuffer);
            }

            if (coverBlob) {
              await storageService.saveBookCover(book.id, coverBlob);
              metadataService.updateBookCover(book.id, true);
              updatedAny = true;
            } else {
              metadataService.updateBookCover(book.id, false);
            }
          }
        } catch (err) {
          console.warn(`Failed to extract cover during refresh for ${book.title}:`, err);
        }
      }
    }

    if (updatedAny) {
      refreshLibraryData();
    } else {
      setRefreshingCovers(false);
    }
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('library_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Auth Sign-In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !nameInput.trim()) return;
    setSigningIn(true);
    try {
      const mockUser = await authService.login(emailInput, nameInput);
      setUser(mockUser);
    } catch (err) {
      console.error(err);
    } finally {
      setSigningIn(false);
    }
  };

  // Auth Sign-Out
  const handleSignOut = async () => {
    await authService.logout();
    setUser(null);
    setCurrentView('dashboard');
    setReadingBook(null);
    setSelectedBook(null);
  };

  // Progress update handler from readers
  const handleProgressUpdate = (bookId: string, percentage: number, extraDetails: { cfi?: string; page?: number }) => {
    const updatedProg = progressService.saveProgress(bookId, percentage, extraDetails);
    
    // Update local state map immediately to reflect on Dashboard
    setProgressMap(prev => ({
      ...prev,
      [bookId]: updatedProg
    }));
  };

  // Delete book handler
  const handleDeleteBook = async (bookId: string) => {
    // Delete metadata
    metadataService.deleteBook(bookId);
    // Delete file from IndexedDB
    await storageService.deleteBookFile(bookId);
    // Delete reading progress
    progressService.deleteProgress(bookId);

    // Refresh state
    refreshLibraryData();
    setSelectedBook(null);
  };

  // Update book category handler
  const handleUpdateCategory = (bookId: string, category: string) => {
    metadataService.updateBookCategory(bookId, category);
    refreshLibraryData();
    setSelectedBook(prev => prev && prev.id === bookId ? { ...prev, category } : prev);
  };

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <Loader2 size={36} className="animate-spin text-accent" />
        <p>Securing sandbox tunnel...</p>
        <style>{`
          .auth-loading-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100vw;
            height: 100vh;
            background-color: #FAF7F2; /* Default ivory fallback */
            color: #2D2A26;
            gap: 1rem;
          }
          [data-theme="dark"] .auth-loading-screen {
            background-color: #121212;
            color: #E6E1DA;
          }
        `}</style>
      </div>
    );
  }

  // Render Login view if user is not authenticated
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card card">
          <header className="login-header">
            <BookOpen className="login-logo text-accent" size={32} />
            <h1>Library</h1>
            <p className="login-subtitle">Your private cloud bookshelf</p>
          </header>

          <form onSubmit={handleSignIn} className="login-form">
            <div className="input-group">
              <label htmlFor="name-input">Full Name</label>
              <input 
                id="name-input"
                type="text" 
                className="input-field" 
                placeholder="e.g. Jane Austen"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                disabled={signingIn}
              />
            </div>

            <div className="input-group">
              <label htmlFor="email-input">Email Address</label>
              <input 
                id="email-input"
                type="email" 
                className="input-field" 
                placeholder="e.g. jane@bookshelf.private"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                disabled={signingIn}
              />
            </div>

            <button type="submit" className="btn btn-primary login-submit-btn" disabled={signingIn}>
              {signingIn ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Configuring personal vault...</span>
                </>
              ) : (
                <span>Access Bookshelf</span>
              )}
            </button>
          </form>

          <footer className="login-footer">
            <div className="security-highlight">
              <Lock size={14} className="security-icon" />
              <span>Private by default. Only you can access your books.</span>
            </div>
            <div className="security-highlight">
              <Shield size={14} className="security-icon" />
              <span>Files are stored encrypted inside your local browser database.</span>
            </div>
          </footer>
        </div>

        <style>{`
          .login-page {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100vw;
            min-height: 100vh;
            background-color: var(--bg-primary);
            padding: 1.5rem;
          }

          .login-card {
            width: 100%;
            max-width: 420px;
            padding: 2.5rem;
            display: flex;
            flex-direction: column;
            gap: 1.75rem;
          }

          .login-header {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
          }

          .login-logo {
            margin-bottom: 0.25rem;
          }

          .login-header h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 0;
          }

          .login-subtitle {
            font-size: 0.9rem;
            color: var(--text-secondary);
          }

          .login-form {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .input-group {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          }

          .input-group label {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
          }

          .login-submit-btn {
            width: 100%;
            margin-top: 0.5rem;
          }

          .login-footer {
            border-top: 1px solid var(--border-color);
            padding-top: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
          }

          .security-highlight {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-secondary);
            line-height: 1.3;
          }

          .security-highlight .security-icon {
            color: var(--accent);
            flex-shrink: 0;
            margin-top: 1px;
          }
        `}</style>
      </div>
    );
  }

  // Render Main Shelf view
  return (
    <div className="app-container">
      {/* Navigation sidebar */}
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        storageStats={storageStats}
        theme={theme}
        toggleTheme={handleToggleTheme}
        user={user}
        onLogout={handleSignOut}
      />

      {/* Main Panel views */}
      <main className="main-content">
        {currentView === 'dashboard' && (
          <Dashboard 
            books={books}
            progressMap={progressMap}
            covers={covers}
            onSelectBook={setSelectedBook}
            onOpenUpload={() => setIsUploadOpen(true)}
            onRefreshCovers={handleRefreshCovers}
            refreshingCovers={refreshingCovers}
          />
        )}
      </main>

      {/* Upload File Modal */}
      {isUploadOpen && (
        <UploadModal 
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            refreshLibraryData();
          }}
        />
      )}

      {/* Book Metadata details popup */}
      {selectedBook && (
        <BookDetailsModal 
          book={selectedBook}
          progress={progressMap[selectedBook.id]?.progress || 0}
          coverUrl={covers[selectedBook.id]}
          onClose={() => setSelectedBook(null)}
          onRead={() => {
            setReadingBook(selectedBook);
            setSelectedBook(null);
          }}
          onDelete={() => handleDeleteBook(selectedBook.id)}
          onUpdateCategory={handleUpdateCategory}
        />
      )}

      {/* Full-screen readers */}
      {readingBook && readingBook.format === 'epub' && (
        <EpubReader 
          book={readingBook}
          initialProgress={progressMap[readingBook.id] || { bookId: readingBook.id, progress: 0, lastRead: '' }}
          onClose={() => {
            setReadingBook(null);
            refreshLibraryData();
          }}
          onProgressUpdate={(prog, cfi) => handleProgressUpdate(readingBook.id, prog, { cfi })}
        />
      )}

      {readingBook && readingBook.format === 'pdf' && (
        <PdfReader 
          book={readingBook}
          initialProgress={progressMap[readingBook.id] || { bookId: readingBook.id, progress: 0, lastRead: '' }}
          onClose={() => {
            setReadingBook(null);
            refreshLibraryData();
          }}
          onProgressUpdate={(prog, page) => handleProgressUpdate(readingBook.id, prog, { page })}
        />
      )}
    </div>
  );
}

export default App;
