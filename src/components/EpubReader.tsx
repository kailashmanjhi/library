import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book as EpubBook, Rendition } from 'epubjs';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  Type, 
  Loader2,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RefreshCw,
  X
} from 'lucide-react';
import type { Book } from '../services/metadataService';
import type { ReadingProgress } from '../services/progressService';
import { storageService } from '../services/storageService';

interface EpubReaderProps {
  book: Book;
  initialProgress: ReadingProgress;
  onClose: () => void;
  onProgressUpdate: (progress: number, cfi: string) => void;
}

interface ReaderSettings {
  fontSize: number; // percentage (80 - 180)
  theme: 'ivory' | 'white' | 'sepia' | 'dark';
  readingWidth: 'narrow' | 'medium' | 'wide';
  lineHeight: 'compact' | 'comfortable' | 'airy';
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 100,
  theme: 'ivory',
  readingWidth: 'medium',
  lineHeight: 'comfortable'
};

const THEMES = {
  ivory: { bg: '#FAF7F2', text: '#2D2A26', border: '#EADFD0', cardBg: '#FFFFFF' },
  white: { bg: '#FFFFFF', text: '#1A1A1A', border: '#E5E5E5', cardBg: '#F5F5F5' },
  sepia: { bg: '#F4ECD8', text: '#5B4636', border: '#EADFC9', cardBg: '#EADFC9' },
  dark: { bg: '#1E1E1E', text: '#E6E1DA', border: '#2A2A2A', cardBg: '#262626' }
};

export const EpubReader: React.FC<EpubReaderProps> = ({
  book,
  initialProgress,
  onClose,
  onProgressUpdate
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookData, setBookData] = useState<ArrayBuffer | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  
  // Immersive Modes & Fullscreen States
  const [readerMode, setReaderMode] = useState<'normal' | 'focus'>('normal');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBanner, setFullscreenBanner] = useState(false);
  
  // Custom Appearance Settings
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    const saved = localStorage.getItem('library_reader_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // use default fallback
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [progressPercent, setProgressPercent] = useState(0);
  const [activeChapter, setActiveChapter] = useState('');

  const epubBookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch file as ArrayBuffer
  useEffect(() => {
    let active = true;
    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const url = await storageService.getBookUrl(book.id);
        if (!url) {
          throw new Error('Could not retrieve book file path. The file may have been deleted.');
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download book content (status: ${response.status})`);
        }
        
        const buffer = await response.arrayBuffer();
        storageService.revokeBookUrl(url);

        if (active) {
          setBookData(buffer);
        }
      } catch (err: any) {
        console.error('Error fetching EPUB ArrayBuffer:', err);
        if (active) {
          setError(err?.message || 'Failed to download EPUB file.');
          setLoading(false);
        }
      }
    };
    loadFile();

    return () => {
      active = false;
    };
  }, [book.id]);

  // 2. Fullscreen Listener to Track Escape Key Exiting Fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      if (isCurrentlyFullscreen) {
        setReaderMode('focus');
        setFullscreenBanner(true);
        const timer = setTimeout(() => setFullscreenBanner(false), 2000);
        return () => clearTimeout(timer);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 3. Auto-Hide Inactivity Timer
  const resetInactivityTimer = () => {
    setControlsVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only auto-hide in focus mode, and only if TOC and Settings panels are closed
    if (readerMode === 'focus' && !tocOpen && !showAppearance) {
      inactivityTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  };

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [readerMode, tocOpen, showAppearance]);

  const registerActivityEvents = (target: Document | Window | HTMLElement) => {
    target.addEventListener('mousemove', resetInactivityTimer);
    target.addEventListener('mousedown', resetInactivityTimer);
    target.addEventListener('keydown', resetInactivityTimer);
    target.addEventListener('touchstart', resetInactivityTimer);
  };

  const unregisterActivityEvents = (target: Document | Window | HTMLElement) => {
    target.removeEventListener('mousemove', resetInactivityTimer);
    target.removeEventListener('mousedown', resetInactivityTimer);
    target.removeEventListener('keydown', resetInactivityTimer);
    target.removeEventListener('touchstart', resetInactivityTimer);
  };

  // Helper to find active chapter from navigation TOC items
  const findActiveChapter = (href: string, tocItems: any[]): any => {
    for (const item of tocItems) {
      const cleanItemHref = item.href ? item.href.split('#')[0] : '';
      const cleanSpineHref = href ? href.split('#')[0] : '';
      
      if (cleanItemHref === cleanSpineHref || (item.href && href.includes(item.href)) || (item.href && item.href.includes(href))) {
        return item;
      }
      if (item.subitems && item.subitems.length > 0) {
        const found = findActiveChapter(href, item.subitems);
        if (found) return found;
      }
    }
    return null;
  };

  // 4. Initialize EpubJS once bookData is loaded and container is ready
  useEffect(() => {
    if (!bookData || !viewerRef.current) return;

    let active = true;
    let epubBook: EpubBook | null = null;
    let rendition: Rendition | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key;
      let handled = false;

      if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'PageDown') {
        handleNextPage();
        handled = true;
      } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
        handlePrevPage();
        handled = true;
      } else if (key === 'f' || key === 'F') {
        toggleFullscreen();
        handled = true;
      } else if (key === 't' || key === 'T') {
        setTocOpen(prev => !prev);
        setShowAppearance(false);
        handled = true;
      } else if (key === 'a' || key === 'A') {
        setShowAppearance(prev => !prev);
        setTocOpen(false);
        handled = true;
      } else if (key === 'Escape') {
        if (tocOpen || showAppearance) {
          setTocOpen(false);
          setShowAppearance(false);
        } else if (document.fullscreenElement) {
          exitFullscreen();
        } else if (readerMode === 'focus') {
          setReaderMode('normal');
        }
        handled = true;
      }

      if (handled) {
        event.preventDefault();
      }
    };

    try {
      epubBook = ePub(bookData);
      epubBookRef.current = epubBook;

      rendition = epubBook.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'auto',
        allowScriptedContent: true
      });
      renditionRef.current = rendition;

      registerActivityEvents(window);
      window.addEventListener('keydown', handleKeyDown);

      rendition.hooks.content.register((contents: any) => {
        const doc = contents.document;
        if (doc) {
          registerActivityEvents(doc);
          doc.addEventListener('keydown', handleKeyDown);
          
          // Mobile responsive tap zones navigation inside iframe
          doc.addEventListener('click', (e: MouseEvent) => {
            const width = doc.documentElement.clientWidth || window.innerWidth;
            const clientX = e.clientX;
            const leftBound = width * 0.33;
            const rightBound = width * 0.66;

            if (clientX < leftBound) {
              handlePrevPage();
            } else if (clientX > rightBound) {
              handleNextPage();
            } else {
              setControlsVisible(prev => !prev);
            }
          });
        }
      });

      epubBook.ready.then(() => {
        if (!active || !epubBook || !rendition) return;

        setToc(epubBook.navigation.toc || []);
        
        const targetCfi = initialProgress.cfi || undefined;
        return rendition.display(targetCfi);
      }).then(() => {
        if (!active) return;
        setLoading(false);
        
        if (epubBook) {
          epubBook.locations.generate(1024).then(() => {
            console.log('EPUB locations generated successfully');
          }).catch(err => {
            console.warn('Locations generation failed but book rendered', err);
          });
        }
      }).catch(err => {
        console.error('Error parsing EPUB ready states:', err);
        if (active) {
          setError(`Failed to open EPUB content: ${err.message || err}`);
          setLoading(false);
        }
      });

      rendition.on('relocated', (location: any) => {
        if (!active || !location || !location.start || !epubBook) return;
        const cfi = location.start.cfi;
        
        let percentage = 0;
        const locations = epubBook.locations as any;
        if (locations && typeof locations.length === 'function' && locations.length() > 0) {
          percentage = locations.percentageFromCfi(cfi) * 100;
        } else {
          const index = location.start.index;
          const total = (epubBook.spine as any).length || 1;
          percentage = (index / total) * 100;
        }
        
        setProgressPercent(Math.round(percentage));
        onProgressUpdate(percentage, cfi);

        // Map chapter label
        const currentSpineHref = epubBook.spine.get(location.start.index)?.href;
        if (currentSpineHref) {
          const activeItem = findActiveChapter(currentSpineHref, epubBook.navigation.toc || []);
          if (activeItem) {
            setActiveChapter(activeItem.label.trim());
          } else {
            setActiveChapter('');
          }
        }
      });

    } catch (err: any) {
      console.error('Error rendering EPUB:', err);
      setError(`Failed to initialize EPUB: ${err.message || err}`);
      setLoading(false);
    }

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      unregisterActivityEvents(window);

      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch (e) {
          console.warn('Rendition destroy failed:', e);
        }
        renditionRef.current = null;
      }
      if (epubBookRef.current) {
        try {
          epubBookRef.current.destroy();
        } catch (e) {
          console.warn('EPUB book destroy failed:', e);
        }
        epubBookRef.current = null;
      }
    };
  }, [bookData]);

  // Apply appearance styles to iframe contents on setting changes
  useEffect(() => {
    if (!renditionRef.current) return;
    const rendition = renditionRef.current;
    const themeColors = THEMES[settings.theme];
    
    const themeRules = {
      body: {
        'background-color': `${themeColors.bg} !important`,
        'color': `${themeColors.text} !important`,
        'line-height': `${settings.lineHeight === 'compact' ? 1.25 : settings.lineHeight === 'comfortable' ? 1.5 : 1.85} !important`,
        'font-family': 'var(--font-sans) !important',
        'padding': '0 20px !important'
      },
      p: {
        'line-height': `${settings.lineHeight === 'compact' ? 1.25 : settings.lineHeight === 'comfortable' ? 1.5 : 1.85} !important`
      },
      a: {
        'color': 'var(--accent) !important',
        'text-decoration': 'underline !important'
      }
    };

    rendition.themes.register('custom-theme', themeRules);
    rendition.themes.select('custom-theme');
    rendition.themes.fontSize(`${settings.fontSize}%`);
  }, [settings, bookData]);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem('library_reader_settings', JSON.stringify(next));
  };

  const changeFontSize = (amount: number) => {
    const nextSize = Math.max(80, Math.min(180, settings.fontSize + amount));
    updateSetting('fontSize', nextSize);
  };

  const navigateToChapter = (href: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(href);
      setTocOpen(false);
    }
  };

  const handlePrevPage = () => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  };

  const handleNextPage = () => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (readerContainerRef.current) {
        readerContainerRef.current.requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            setReaderMode('focus');
          })
          .catch(err => {
            console.error('Error entering fullscreen:', err);
          });
      }
    } else {
      document.exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch(err => {
          console.error('Error exiting fullscreen:', err);
        });
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const activeTheme = THEMES[settings.theme];

  return (
    <div 
      ref={readerContainerRef}
      className={`reader-overlay theme-${settings.theme} size-${settings.readingWidth} ${isFullscreen ? 'fullscreen' : ''} ${controlsVisible ? 'controls-visible' : 'controls-hidden'}`}
      style={{
        backgroundColor: activeTheme.bg,
        color: activeTheme.text
      }}
    >
      {/* Fullscreen Banner Hint */}
      {fullscreenBanner && (
        <div className="fullscreen-hint">
          Press Esc to exit fullscreen
        </div>
      )}

      {/* Header bar */}
      <header className="reader-header" style={{ borderColor: activeTheme.border }}>
        <div className="reader-header-left">
          <button 
            onClick={onClose} 
            className="reader-back-btn" 
            title="Back to Bookshelf" 
            aria-label="Back to bookshelf"
            style={{ borderColor: activeTheme.border }}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="reader-title-group">
            <h2 className="reader-book-title">{book.title}</h2>
            <span className="reader-book-author">by {book.author}</span>
          </div>
        </div>

        <div className="reader-header-right">
          {/* Focus Mode Toggle */}
          <button 
            onClick={() => {
              const nextMode = readerMode === 'normal' ? 'focus' : 'normal';
              setReaderMode(nextMode);
              if (nextMode === 'normal') {
                setControlsVisible(true);
              }
            }} 
            className={`reader-header-btn ${readerMode === 'focus' ? 'active' : ''}`}
            title={readerMode === 'focus' ? "Focus Mode Active" : "Enable Focus Mode"}
            aria-label="Toggle focus mode"
          >
            {readerMode === 'focus' ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          {/* Aa Appearance Panel Toggle */}
          <button 
            onClick={() => {
              setShowAppearance(!showAppearance);
              setTocOpen(false);
            }} 
            className={`reader-header-btn ${showAppearance ? 'active' : ''}`}
            title="Appearance Settings"
            aria-label="Toggle appearance panel"
          >
            <Type size={20} />
          </button>

          {/* Fullscreen Toggle */}
          <button 
            onClick={toggleFullscreen} 
            className="reader-header-btn"
            title="Toggle Fullscreen"
            aria-label="Toggle fullscreen view"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* TOC Toggle */}
          <button 
            onClick={() => {
              setTocOpen(!tocOpen);
              setShowAppearance(false);
            }} 
            className={`reader-header-btn ${tocOpen ? 'active' : ''}`}
            title="Table of Contents"
            aria-label="Toggle table of contents"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Reader area */}
      <div className="reader-body" onClick={resetInactivityTimer}>
        {/* Table of Contents Drawer Backdrop */}
        {tocOpen && <div className="toc-backdrop" onClick={() => setTocOpen(false)} />}

        {/* Table of Contents Drawer */}
        <div 
          className={`reader-toc-drawer ${tocOpen ? 'open' : 'closed'}`}
          style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
        >
          <div className="toc-header" style={{ borderColor: activeTheme.border }}>
            <h3>Table of Contents</h3>
            <button onClick={() => setTocOpen(false)} aria-label="Close table of contents" className="toc-close-btn">
              <X size={18} />
            </button>
          </div>
          <ul className="toc-list">
            {toc.map((item, index) => {
              // Match active chapter
              const cleanItemHref = item.href ? item.href.split('#')[0] : '';
              const isActive = cleanItemHref && activeChapter.toLowerCase().includes(item.label.trim().toLowerCase());

              return (
                <li key={index} className="toc-item" style={{ borderColor: activeTheme.border }}>
                  <button 
                    onClick={() => navigateToChapter(item.href)} 
                    className={`toc-link ${isActive ? 'active-chapter' : ''}`}
                    style={{ color: activeTheme.text }}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
            {toc.length === 0 && (
              <li className="toc-item-empty">No chapters found</li>
            )}
          </ul>
        </div>

        {/* EPUB Viewer Container */}
        <div className="reader-viewer-container">
          {loading && !error && (
            <div className="reader-loading-spinner">
              <Loader2 size={36} className="animate-spin text-accent" />
              <p>Opening digital pages securely...</p>
            </div>
          )}

          {error && (
            <div className="reader-error-state container-centered" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
              <p className="error-text">{error}</p>
              <button className="btn btn-primary" onClick={onClose}>
                Back to Bookshelf
              </button>
            </div>
          )}

          {!error && (
            <div 
              ref={viewerRef} 
              className="epub-viewer-element"
              style={{ 
                borderColor: activeTheme.border,
                backgroundColor: activeTheme.cardBg
              }}
            ></div>
          )}

          {/* Nav Overlays / Desktop Hit Zones */}
          {!loading && !error && (
            <>
              <button 
                onClick={handlePrevPage} 
                className="nav-overlay-btn prev-overlay" 
                title="Previous Page"
                aria-label="Previous page"
                style={{ color: activeTheme.text }}
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                onClick={handleNextPage} 
                className="nav-overlay-btn next-overlay" 
                title="Next Page"
                aria-label="Next page"
                style={{ color: activeTheme.text }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        {/* Appearance Control Drawer Panel */}
        {showAppearance && (
          <div className="appearance-panel" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            <div className="panel-header" style={{ borderColor: activeTheme.border }}>
              <h3>Appearance Settings</h3>
              <button onClick={() => setShowAppearance(false)} aria-label="Close settings" className="panel-close-btn">
                <X size={18} />
              </button>
            </div>
            
            <div className="panel-body">
              {/* Font Size Adjuster */}
              <div className="settings-group">
                <span className="settings-label">Font Size</span>
                <div className="font-size-adjuster">
                  <button onClick={() => changeFontSize(-10)} aria-label="Decrease font size" className="setting-btn" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}>
                    Aa-
                  </button>
                  <span className="current-font-size">{settings.fontSize}%</span>
                  <button onClick={() => changeFontSize(10)} aria-label="Increase font size" className="setting-btn" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}>
                    Aa+
                  </button>
                </div>
              </div>

              {/* Theme selection */}
              <div className="settings-group">
                <span className="settings-label">Reading Theme</span>
                <div className="theme-selector-grid">
                  {(['ivory', 'white', 'sepia', 'dark'] as const).map(t => (
                    <button 
                      key={t}
                      onClick={() => updateSetting('theme', t)}
                      className={`theme-chip theme-${t} ${settings.theme === t ? 'active' : ''}`}
                      aria-label={`${t} theme`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading widths */}
              <div className="settings-group">
                <span className="settings-label">Reading Width</span>
                <div className="setting-options-row">
                  {(['narrow', 'medium', 'wide'] as const).map(w => (
                    <button 
                      key={w}
                      onClick={() => updateSetting('readingWidth', w)}
                      className={`option-chip ${settings.readingWidth === w ? 'active' : ''}`}
                      aria-label={`${w} reading width`}
                      style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}
                    >
                      {w.charAt(0).toUpperCase() + w.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line heights */}
              <div className="settings-group">
                <span className="settings-label">Line Spacing</span>
                <div className="setting-options-row">
                  {(['compact', 'comfortable', 'airy'] as const).map(l => (
                    <button 
                      key={l}
                      onClick={() => updateSetting('lineHeight', l)}
                      className={`option-chip ${settings.lineHeight === l ? 'active' : ''}`}
                      aria-label={`${l} line spacing`}
                      style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}
                    >
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset to Default */}
              <button 
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  localStorage.setItem('library_reader_settings', JSON.stringify(DEFAULT_SETTINGS));
                }}
                className="btn btn-secondary reset-appearance-btn"
                aria-label="Reset appearance to default"
                style={{ borderColor: activeTheme.border }}
              >
                <RefreshCw size={14} />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reader Footer progress bar */}
      <footer className="reader-footer-nav" style={{ borderColor: activeTheme.border }}>
        <div className="footer-progress-container">
          <div className="footer-progress-meta">
            <span className="current-chapter-title">
              {activeChapter || 'Reading Book'}
            </span>
            <span className="progress-percentage-label">
              {progressPercent}% Read
            </span>
          </div>
          <div className="progress-bar-track" style={{ backgroundColor: settings.theme === 'dark' ? '#333' : '#EADFD0' }}>
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </footer>

      <style>{`
        .reader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: background-color var(--transition-normal), color var(--transition-normal);
        }

        .reader-header {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 2rem;
          background-color: inherit;
          border-bottom: 1px solid var(--border-color);
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        .reader-footer-nav {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0 2rem;
          background-color: inherit;
          border-top: 1px solid var(--border-color);
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        .controls-hidden .reader-header {
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
        }

        .controls-hidden .reader-footer-nav {
          transform: translateY(100%);
          opacity: 0;
          pointer-events: none;
        }

        .reader-body {
          flex: 1;
          display: flex;
          position: relative;
          width: 100%;
          height: 100%;
          padding: 60px 0; /* Padding for header/footer */
          box-sizing: border-box;
        }

        .controls-hidden .reader-body {
          padding: 0;
        }

        .reader-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
          overflow: hidden;
          max-width: 50%;
        }

        .reader-back-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          background-color: transparent;
          border: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .reader-back-btn:hover {
          background-color: var(--border-color);
        }

        .reader-title-group {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          overflow: hidden;
        }

        .reader-book-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: inherit;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reader-book-author {
          font-size: 0.75rem;
          opacity: 0.8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .reader-header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .reader-header-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          color: inherit;
          transition: all var(--transition-fast);
        }

        .reader-header-btn:hover {
          background-color: var(--border-color);
        }

        .reader-header-btn.active {
          background-color: var(--accent-light);
          color: var(--accent);
        }

        /* TOC Drawer Styles */
        .reader-toc-drawer {
          width: 300px;
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 100;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .reader-toc-drawer.closed {
          transform: translateX(-300px);
        }

        .reader-toc-drawer.open {
          transform: translateX(0);
        }

        .toc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .toc-header h3 {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0;
        }

        .toc-close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          opacity: 0.8;
        }

        .toc-close-btn:hover {
          opacity: 1;
          background-color: var(--border-color);
        }

        .toc-list {
          list-style: none;
          display: flex;
          flex-direction: column;
        }

        .toc-item {
          border-bottom: 1px solid var(--border-color);
        }

        .toc-link {
          width: 100%;
          text-align: left;
          padding: 0.9rem 1.5rem;
          font-size: 0.9rem;
          transition: background-color var(--transition-fast);
        }

        .toc-link:hover {
          background-color: var(--border-color);
        }

        .toc-link.active-chapter {
          background-color: var(--accent-light) !important;
          color: var(--accent) !important;
          font-weight: 600;
        }

        .toc-item-empty {
          padding: 1.5rem;
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-tertiary);
        }

        /* Viewer Element Styles */
        .reader-viewer-container {
          flex: 1;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem 0;
          box-sizing: border-box;
        }

        .epub-viewer-element {
          width: 100%;
          height: 100%;
          margin: 0 auto;
          box-shadow: var(--shadow-md);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }

        .size-narrow .epub-viewer-element { max-width: 600px; }
        .size-medium .epub-viewer-element { max-width: 800px; }
        .size-wide .epub-viewer-element { max-width: 1000px; }

        .reader-loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--text-secondary);
        }

        .reader-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          padding: 2.5rem;
          max-width: 450px;
          text-align: center;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
        }

        .error-text {
          font-size: 0.95rem;
          color: #EF4444;
          line-height: 1.5;
          font-weight: 500;
        }

        .container-centered {
          margin: auto;
          text-align: center;
        }

        /* Fullscreen Banner Hint */
        .fullscreen-hint {
          position: absolute;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: #FFFFFF;
          padding: 0.5rem 1.25rem;
          border-radius: var(--radius-full);
          font-size: 0.85rem;
          z-index: 1000;
          pointer-events: none;
          animation: fade-in-out 2s forwards;
        }

        @keyframes fade-in-out {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
        }

        /* Appearance panel */
        .appearance-panel {
          position: absolute;
          right: 2rem;
          top: 70px;
          width: 320px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 110;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .panel-close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          opacity: 0.8;
        }

        .panel-close-btn:hover {
          opacity: 1;
          background-color: var(--border-color);
        }

        .settings-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .settings-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .font-size-adjuster {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .setting-btn {
          flex: 1;
          height: 32px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .setting-btn:hover {
          opacity: 0.9;
        }

        .current-font-size {
          font-size: 0.85rem;
          font-weight: 700;
          min-width: 50px;
          text-align: center;
        }

        .theme-selector-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .theme-chip {
          height: 36px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .theme-chip.theme-ivory { background-color: #FAF7F2; color: #2D2A26; }
        .theme-chip.theme-white { background-color: #FFFFFF; color: #1A1A1A; }
        .theme-chip.theme-sepia { background-color: #F4ECD8; color: #5B4636; }
        .theme-chip.theme-dark { background-color: #1E1E1E; color: #E6E1DA; }

        .theme-chip.active {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-light);
        }

        .setting-options-row {
          display: flex;
          gap: 0.35rem;
        }

        .option-chip {
          flex: 1;
          height: 32px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .option-chip.active {
          background-color: var(--accent) !important;
          border-color: var(--accent) !important;
          color: #FFFFFF !important;
        }

        .reset-appearance-btn {
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          height: 36px;
          background-color: transparent;
        }

        /* TOC Backdrop */
        .toc-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.4);
          z-index: 95;
          animation: fade-in 0.2s ease-out;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Footer Progress elements */
        .footer-progress-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 600px;
          gap: 0.35rem;
        }

        .footer-progress-meta {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.75rem;
          font-weight: 600;
          opacity: 0.8;
        }

        .current-chapter-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }

        .progress-bar-track {
          width: 100%;
          height: 4px;
          border-radius: var(--radius-full);
          position: relative;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background-color: var(--accent);
          border-radius: var(--radius-full);
        }

        /* Nav Overlays / Hit Zones */
        .nav-overlay-btn {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 10%;
          min-width: 60px;
          max-width: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: inherit;
          opacity: 0;
          z-index: 10;
          transition: all var(--transition-normal);
        }

        .nav-overlay-btn:hover {
          opacity: 0.6;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.02), transparent);
        }

        .next-overlay:hover {
          background: linear-gradient(to left, rgba(0, 0, 0, 0.02), transparent);
        }

        .prev-overlay { left: 0; }
        .next-overlay { right: 0; }

        @media (max-width: 768px) {
          .nav-overlay-btn {
            display: none; /* Hide hit zones on mobile to prioritize tap zones */
          }
          
          .reader-header {
            padding: 0 1rem;
          }

          .appearance-panel {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: auto;
            width: 100%;
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            border-bottom: none;
            z-index: 210;
            animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .reader-toc-drawer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            top: 0;
            width: 100%;
            z-index: 200;
            border-right: none;
            border-top: 1px solid var(--border-color);
            transform: translateY(100%);
          }

          .reader-toc-drawer.open {
            transform: translateY(0);
          }

          .reader-toc-drawer.closed {
            transform: translateY(100%);
          }
        }

        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .reader-header,
          .reader-footer-nav,
          .reader-toc-drawer,
          .appearance-panel {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
