import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Type,
  RefreshCw,
  X
} from 'lucide-react';
import type { Book } from '../services/metadataService';
import type { ReadingProgress } from '../services/progressService';
import { storageService } from '../services/storageService';

// Set up the worker source using CDN to avoid Vite build/bundling asset issues.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfReaderProps {
  book: Book;
  initialProgress: ReadingProgress;
  onClose: () => void;
  onProgressUpdate: (progress: number, page: number) => void;
}

interface PdfReaderSettings {
  theme: 'ivory' | 'white' | 'sepia' | 'dark';
  readingWidth: 'narrow' | 'medium' | 'wide';
}

const DEFAULT_SETTINGS: PdfReaderSettings = {
  theme: 'ivory',
  readingWidth: 'medium'
};

const THEMES = {
  ivory: { bg: '#FAF7F2', text: '#2D2A26', border: '#EADFD0', cardBg: '#FFFFFF' },
  white: { bg: '#FFFFFF', text: '#1A1A1A', border: '#E5E5E5', cardBg: '#F5F5F5' },
  sepia: { bg: '#F4ECD8', text: '#5B4636', border: '#EADFC9', cardBg: '#EADFC9' },
  dark: { bg: '#1E1E1E', text: '#E6E1DA', border: '#2A2A2A', cardBg: '#262626' }
};

export const PdfReader: React.FC<PdfReaderProps> = ({
  book,
  initialProgress,
  onClose,
  onProgressUpdate
}) => {
  const [loading, setLoading] = useState(true);
  const [bookUrl, setBookUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(initialProgress.page || 1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [useNativeViewer, setUseNativeViewer] = useState(true); // Native browser PDF viewer by default
  const [canvasModeFailed, setCanvasModeFailed] = useState(false);

  // Focus Modes & Settings Panel
  const [readerMode, setReaderMode] = useState<'normal' | 'focus'>('normal');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBanner, setFullscreenBanner] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  const [settings, setSettings] = useState<PdfReaderSettings>(() => {
    const saved = localStorage.getItem('library_pdf_reader_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // use defaults
      }
    }
    return DEFAULT_SETTINGS;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load book PDF Blob URL from IndexedDB
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    
    const fetchBlob = async () => {
      try {
        const url = await storageService.getBookUrl(book.id);
        if (active && url) {
          localUrl = url;
          setBookUrl(url);
        } else if (active) {
          setRenderError(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching PDF from IndexedDB:', err);
        if (active) {
          setRenderError(true);
          setLoading(false);
        }
      }
    };
    fetchBlob();

    return () => {
      active = false;
      if (localUrl) {
        storageService.revokeBookUrl(localUrl);
      }
    };
  }, [book.id]);

  // 2. Initialize PDF Document
  useEffect(() => {
    if (!bookUrl) return;

    if (useNativeViewer) {
      setLoading(false);
    } else {
      setLoading(true);
    }
    setRenderError(false);

    const loadingTask = pdfjsLib.getDocument({ url: bookUrl });
    loadingTask.promise.then(
      (loadedPdf) => {
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setCanvasModeFailed(false);
        setLoading(false);
      },
      (error) => {
        console.warn('pdf.js failed to load PDF document, defaulting to native view:', error);
        setCanvasModeFailed(true);
        setUseNativeViewer(true);
        setLoading(false);
      }
    );

    return () => {
      loadingTask.destroy();
    };
  }, [bookUrl]);

  // 3. Render current page to Canvas
  const renderPage = async (pageNum: number, currentScale: number) => {
    if (!pdfDoc || !canvasRef.current || useNativeViewer) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    setRendering(true);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        setRendering(false);
        return;
      }

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : null;

      const renderContext = {
        canvasContext: context,
        transform: transform || undefined,
        viewport: viewport,
        canvas: canvas,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      setRendering(false);

      // Report progress
      const progressPercent = Math.round((pageNum / numPages) * 100);
      onProgressUpdate(progressPercent, pageNum);
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Page rendering error:', err);
        setCanvasModeFailed(true);
        setUseNativeViewer(true); // fallback to native browser view automatically if canvas fails
        setRendering(false);
      }
    }
  };

  useEffect(() => {
    if (pdfDoc && !useNativeViewer) {
      renderPage(pageNumber, scale);
    }
  }, [pdfDoc, pageNumber, scale, useNativeViewer]);

  // 4. Fullscreen Listener
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

  // 5. Inactivity Timer (Auto-Hide Controls)
  const resetInactivityTimer = () => {
    setControlsVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (readerMode === 'focus' && !showAppearance) {
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
  }, [readerMode, showAppearance]);

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

  // 6. Keyboard Shortcuts & Click Listeners
  useEffect(() => {
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
      } else if (key === 'a' || key === 'A') {
        setShowAppearance(prev => !prev);
        handled = true;
      } else if (key === 'Escape') {
        if (showAppearance) {
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

    registerActivityEvents(window);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unregisterActivityEvents(window);
    };
  }, [pdfDoc, pageNumber, numPages, isFullscreen, showAppearance, readerMode, useNativeViewer]);

  const handlePrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const handleNextPage = () => {
    if (pdfDoc && pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const handleZoomOut = () => {
    setScale(Math.max(0.5, scale - 0.25));
  };

  const handleZoomIn = () => {
    setScale(Math.min(3.0, scale + 0.25));
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

  const updateSetting = <K extends keyof PdfReaderSettings>(key: K, value: PdfReaderSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem('library_pdf_reader_settings', JSON.stringify(next));
  };

  const handleDownloadPdf = () => {
    if (!bookUrl) return;
    const link = document.createElement('a');
    link.href = bookUrl;
    link.download = `${book.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressPercent = numPages > 0 ? Math.round((pageNumber / numPages) * 100) : 0;
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
      {/* Fullscreen Hint Toast */}
      {fullscreenBanner && (
        <div className="fullscreen-hint">
          Press Esc to exit fullscreen
        </div>
      )}

      {/* PDF Header Controls */}
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
          {/* Zoom controls (hidden in Native mode) */}
          {!useNativeViewer && !renderError && !loading && (
            <div className="reader-zoom-controls" style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}>
              <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out" aria-label="Zoom out">
                <ZoomOut size={16} />
              </button>
              <span className="zoom-scale-text">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In" aria-label="Zoom in">
                <ZoomIn size={16} />
              </button>
            </div>
          )}

          {/* Toggle Viewer Button */}
          {bookUrl && !loading && !renderError && (
            <button 
              onClick={() => {
                if (canvasModeFailed) return;
                setUseNativeViewer(!useNativeViewer);
              }} 
              className={`viewer-toggle-btn btn btn-secondary`}
              title={canvasModeFailed ? "Canvas mode failed" : "Toggle Native Browser View"}
              aria-label="Toggle native browser view"
              disabled={canvasModeFailed}
              style={{ borderColor: activeTheme.border }}
            >
              {useNativeViewer ? <Eye size={16} /> : <ExternalLink size={16} />}
              <span>{useNativeViewer ? 'Canvas Mode' : 'Native View'}</span>
            </button>
          )}

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

          {/* Appearance Settings Panel Toggle */}
          <button 
            onClick={() => setShowAppearance(!showAppearance)} 
            className={`reader-header-btn ${showAppearance ? 'active' : ''}`}
            title="Appearance Settings"
            aria-label="Toggle appearance settings"
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
        </div>
      </header>

      {/* Main View Area */}
      <div 
        className="reader-body" 
        onClick={(e) => {
          resetInactivityTimer();
          
          // Mobile Responsive Tap zones when clicking reader body
          const width = window.innerWidth;
          const clientX = e.clientX;
          const leftBound = width * 0.33;
          const rightBound = width * 0.66;
          
          if (width <= 768 && !useNativeViewer && !loading && !renderError) {
            if (clientX < leftBound) {
              handlePrevPage();
            } else if (clientX > rightBound) {
              handleNextPage();
            } else {
              setControlsVisible(prev => !prev);
            }
          }
        }}
      >
        {loading && (
          <div className="reader-loading-spinner container-centered">
            <Loader2 size={36} className="animate-spin text-accent" />
            <p>Scanning document layers privately...</p>
          </div>
        )}

        {/* Friendly Error Fallback */}
        {renderError && !loading && (
          <div className="reader-error-state container-centered" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}>
            <p className="error-text">This PDF could not be rendered inside Library. Open it with your browser’s PDF reader.</p>
            <div className="error-actions" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {bookUrl && (
                <a 
                  href={bookUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary"
                  title="Open in Browser Reader"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                >
                  <ExternalLink size={16} />
                  <span>Open in Browser Reader</span>
                </a>
              )}
              <button 
                className="btn btn-secondary text-primary" 
                onClick={handleDownloadPdf}
                title="Download PDF file"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                Download PDF
              </button>
            </div>
          </div>
        )}

        {/* Canvas Viewer Mode */}
        {!loading && !renderError && !useNativeViewer && (
          <div className="pdf-canvas-container">
            <div className="canvas-wrapper" style={{ borderColor: activeTheme.border }}>
              <canvas ref={canvasRef} />
              {rendering && (
                <div className="canvas-rendering-indicator">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              )}
            </div>

            {/* Pagination hit zones / Floating buttons */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handlePrevPage();
              }}
              className={`nav-overlay-btn prev-overlay ${pageNumber === 1 ? 'disabled' : ''}`}
              disabled={pageNumber === 1}
              title="Previous Page"
              aria-label="Previous page"
              style={{ color: activeTheme.text }}
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleNextPage();
              }}
              className={`nav-overlay-btn next-overlay ${pageNumber === numPages ? 'disabled' : ''}`}
              disabled={pageNumber === numPages}
              title="Next Page"
              aria-label="Next page"
              style={{ color: activeTheme.text }}
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Native Browser Iframe Viewer Mode */}
        {!loading && !renderError && useNativeViewer && bookUrl && (
          <div className="pdf-native-iframe-container">
            <iframe 
              src={`${bookUrl}#toolbar=1`} 
              title={book.title}
              className="pdf-iframe"
            />
          </div>
        )}

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
              {!useNativeViewer && (
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
              )}

              {/* Fallback Buttons */}
              <div className="settings-group">
                <span className="settings-label">File Actions</span>
                <div className="setting-options-row">
                  {bookUrl && (
                    <a 
                      href={bookUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="option-chip"
                      style={{ 
                        textDecoration: 'none',
                        borderColor: activeTheme.border, 
                        backgroundColor: activeTheme.bg,
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        color: activeTheme.text
                      }}
                      title="Open PDF in a new browser tab"
                    >
                      <ExternalLink size={14} />
                      <span>Open in Tab</span>
                    </a>
                  )}
                  <button 
                    onClick={handleDownloadPdf} 
                    className="option-chip"
                    style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg, color: activeTheme.text }}
                    title="Download PDF to device"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Reset to Default */}
              <button 
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  localStorage.setItem('library_pdf_reader_settings', JSON.stringify(DEFAULT_SETTINGS));
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

      {/* Footer page tracker */}
      {!loading && !renderError && (
        <footer className="reader-footer-nav" style={{ borderColor: activeTheme.border }}>
          <div className="footer-progress-container">
            <div className="footer-progress-meta">
              <span className="pdf-page-indicator">
                {useNativeViewer 
                  ? (numPages > 0 ? `Native View (Page ${pageNumber} of ${numPages})` : "Native Browser Reader Active")
                  : `Page ${pageNumber} of ${numPages}`
                }
              </span>
              <span className="progress-percentage-label">
                {numPages > 0 ? `${progressPercent}% Read` : ''}
              </span>
            </div>
            {numPages > 0 && (
              <div className="progress-bar-track" style={{ backgroundColor: settings.theme === 'dark' ? '#333' : '#EADFD0' }}>
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            )}
          </div>
        </footer>
      )}

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

        .container-centered {
          margin: auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
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

        .reader-zoom-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid var(--border-color);
          padding: 0.25rem;
          border-radius: var(--radius-full);
        }

        .zoom-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          color: inherit;
        }

        .zoom-btn:hover {
          background-color: var(--border-color);
        }

        .zoom-scale-text {
          font-size: 0.75rem;
          font-weight: 700;
          min-width: 45px;
          text-align: center;
        }

        .viewer-toggle-btn {
          font-size: 0.8rem;
          padding: 0.45rem 1rem;
          border-radius: var(--radius-full);
          background-color: transparent;
        }

        /* Error state screen */
        .reader-error-state {
          padding: 2rem;
          max-width: 400px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
        }

        .error-text {
          font-size: 0.9rem;
          color: #EF4444;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        /* Canvas layouts */
        .pdf-canvas-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start; /* scroll canvas from top */
          overflow: auto;
          position: relative;
          padding: 2rem 1rem;
        }

        .canvas-wrapper {
          position: relative;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border-color);
          background-color: #FFFFFF; /* white background for document pages */
          border-radius: var(--radius-sm);
          transition: filter 0.3s ease;
        }

        /* PDF Color Inversion for Comfortable Dark Mode Reading */
        .theme-dark .canvas-wrapper {
          filter: invert(0.85) hue-rotate(180deg);
        }

        .size-narrow .canvas-wrapper { max-width: 600px; }
        .size-medium .canvas-wrapper { max-width: 800px; }
        .size-wide .canvas-wrapper { max-width: 1000px; }

        .canvas-rendering-indicator {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background-color: rgba(0, 0, 0, 0.6);
          color: #FFFFFF;
          padding: 0.5rem;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .disabled {
          opacity: 0.2 !important;
          cursor: not-allowed !important;
        }

        /* Native Iframe viewer styles */
        .pdf-native-iframe-container {
          width: 100%;
          height: 100%;
          background-color: var(--bg-tertiary);
        }

        .pdf-iframe {
          width: 100%;
          height: 100%;
          border: none;
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

        /* Appearance settings panel */
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

        /* Footer Progress track */
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

        /* Hit Zones */
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
            display: none;
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
        }

        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .reader-header,
          .reader-footer-nav,
          .appearance-panel {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
