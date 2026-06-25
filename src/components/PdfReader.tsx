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
  Maximize2,
  Minimize2,
  Type,
  RefreshCw,
  X
} from 'lucide-react';
import type { Book } from '../services/metadataService';
import type { ReadingProgress } from '../services/progressService';
import { storageService } from '../services/storageService';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up the worker source using local Vite-served worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfReaderProps {
  book: Book;
  initialProgress: ReadingProgress;
  onClose: () => void;
  onProgressUpdate: (progress: number, page: number) => void;
}

interface PdfReaderSettings {
  theme: 'ivory' | 'white' | 'sepia' | 'dark';
  readingWidth: 'narrow' | 'medium' | 'wide';
  animation: 'none' | 'slide' | 'curl';
}

const DEFAULT_SETTINGS: PdfReaderSettings = {
  theme: 'ivory',
  readingWidth: 'medium',
  animation: 'slide'
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBanner, setFullscreenBanner] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<'left' | 'right' | null>(null);

  const [settings, setSettings] = useState<PdfReaderSettings>(() => {
    const saved = localStorage.getItem('library_pdf_reader_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        // use defaults
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Page Turn Animation state & ref
  const [animatingState, setAnimatingState] = useState<{ direction: 'next' | 'prev'; type: 'none' | 'slide' | 'curl' } | null>(null);
  const animatingStateRef = useRef<any>(null);
  animatingStateRef.current = animatingState;
  const isTurningPageRef = useRef<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const readerContainerRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenBannerTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement || 
        (document as any).mozFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      if (isCurrentlyFullscreen) {
        setFullscreenBanner(true);
        if (fullscreenBannerTimerRef.current) {
          clearTimeout(fullscreenBannerTimerRef.current);
        }
        fullscreenBannerTimerRef.current = setTimeout(() => {
          setFullscreenBanner(false);
        }, 2000);
        
        // Reveal controls briefly on entering fullscreen
        resetInactivityTimer();
      } else {
        setFullscreenBanner(false);
        if (fullscreenBannerTimerRef.current) {
          clearTimeout(fullscreenBannerTimerRef.current);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // 5. Inactivity Timer (Auto-Hide Controls)
  const showAppearanceRef = useRef(showAppearance);

  useEffect(() => {
    showAppearanceRef.current = showAppearance;
  }, [showAppearance]);

  const resetInactivityTimer = () => {
    setControlsVisible(true);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (!showAppearanceRef.current) {
      inactivityTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  };

  useEffect(() => {
    if (showAppearance) {
      setControlsVisible(true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    } else {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [showAppearance]);

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

  const isInteractiveElement = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'LABEL'];
    let current: HTMLElement | null = el;
    while (current && current !== document.body) {
      if (interactiveTags.includes(current.tagName)) {
        return true;
      }
      if (current.getAttribute('role') === 'button') {
        return true;
      }
      if (
        current.classList.contains('reader-header') ||
        current.classList.contains('reader-footer-nav') ||
        current.classList.contains('appearance-panel') ||
        current.classList.contains('canvas-rendering-indicator')
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  const hasActiveSelection = (target: HTMLElement | null): boolean => {
    const mainSelection = window.getSelection()?.toString();
    if (mainSelection && mainSelection.trim().length > 0) {
      return true;
    }
    const targetDoc = target?.ownerDocument;
    if (targetDoc) {
      const targetSelection = targetDoc.getSelection()?.toString();
      if (targetSelection && targetSelection.trim().length > 0) {
        return true;
      }
    }
    return false;
  };

  const handleViewportClick = (clientX: number, target: HTMLElement | null) => {
    if (useNativeViewer || loading || renderError || showAppearanceRef.current) {
      return;
    }
    if (isInteractiveElement(target)) {
      return;
    }
    if (hasActiveSelection(target)) {
      return;
    }
    const width = window.innerWidth;
    const isMobile = width <= 768;
    const ratio = isMobile ? 0.32 : 0.28;
    const leftBound = width * ratio;
    const rightBound = width * (1 - ratio);

    if (clientX < leftBound) {
      triggerPageTurn('prev');
    } else if (clientX > rightBound) {
      triggerPageTurn('next');
    } else {
      setControlsVisible(prev => !prev);
    }
  };

  const handleMouseMove = (clientX: number, isMouseDown: boolean) => {
    if (useNativeViewer || isMouseDown || window.innerWidth <= 768 || loading || renderError || showAppearanceRef.current) {
      setHoveredZone(null);
      return;
    }
    const width = window.innerWidth;
    const leftBound = width * 0.28;
    const rightBound = width * (1 - 0.28);

    if (clientX < leftBound) {
      setHoveredZone('left');
    } else if (clientX > rightBound) {
      setHoveredZone('right');
    } else {
      setHoveredZone(null);
    }
  };

  const handleWindowMouseMove = (e: MouseEvent) => {
    handleMouseMove(e.clientX, e.buttons > 0);
  };

  const handleMouseLeave = () => {
    setHoveredZone(null);
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
        triggerPageTurn('next');
        handled = true;
      } else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') {
        triggerPageTurn('prev');
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
        } else if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement || (document as any).mozFullscreenElement || isFullscreen) {
          exitFullscreen();
        }
        handled = true;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    registerActivityEvents(window);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      unregisterActivityEvents(window);
    };
  }, [pdfDoc, pageNumber, numPages, isFullscreen, showAppearance, useNativeViewer, loading, renderError]);

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

  const getOverlayBg = (themeBg: string, isCurl: boolean) => {
    if (!isCurl) return themeBg;
    if (themeBg.startsWith('#')) {
      return themeBg + 'E6';
    }
    return themeBg;
  };

  const triggerPageTurn = (direction: 'next' | 'prev') => {
    if (isTurningPageRef.current || animatingStateRef.current) {
      return;
    }
    isTurningPageRef.current = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animType = prefersReducedMotion ? 'none' : settings.animation;

    const isMobile = window.innerWidth <= 768;
    const duration = animType === 'none'
      ? 0
      : (animType === 'slide' ? 180 : (isMobile ? 600 : 750));

    const lockDuration = animType === 'none'
      ? 250
      : duration + 50;

    if (animType === 'none') {
      if (direction === 'next') {
        handleNextPage();
      } else {
        handlePrevPage();
      }
      setTimeout(() => {
        isTurningPageRef.current = false;
      }, lockDuration);
      return;
    }

    const midpoint = duration / 2;

    setAnimatingState({ direction, type: animType });

    setTimeout(() => {
      if (direction === 'next') {
        handleNextPage();
      } else {
        handlePrevPage();
      }
    }, midpoint);

    setTimeout(() => {
      setAnimatingState(null);
    }, duration);

    setTimeout(() => {
      isTurningPageRef.current = false;
    }, lockDuration);
  };

  const handleZoomOut = () => {
    setScale(Math.max(0.5, scale - 0.25));
  };

  const handleZoomIn = () => {
    setScale(Math.min(3.0, scale + 0.25));
  };

  const toggleFullscreen = () => {
    const element = readerContainerRef.current;
    if (!element) return;

    const requestFs = element.requestFullscreen || 
                      (element as any).webkitRequestFullscreen || 
                      (element as any).msRequestFullscreen || 
                      (element as any).mozRequestFullScreen;

    const exitFs = document.exitFullscreen || 
                   (document as any).webkitExitFullscreen || 
                   (document as any).msExitFullscreen || 
                   (document as any).mozCancelFullScreen;

    const getFsElement = () => document.fullscreenElement || 
                              (document as any).webkitFullscreenElement || 
                              (document as any).msFullscreenElement || 
                              (document as any).mozFullscreenElement;

    if (!getFsElement()) {
      if (requestFs) {
        requestFs.call(element)
          .then(() => {
            setIsFullscreen(true);
          })
          .catch(err => {
            console.warn('Native requestFullscreen failed, falling back to CSS:', err);
            setIsFullscreen(true);
            setFullscreenBanner(true);
            if (fullscreenBannerTimerRef.current) clearTimeout(fullscreenBannerTimerRef.current);
            fullscreenBannerTimerRef.current = setTimeout(() => setFullscreenBanner(false), 2000);
            resetInactivityTimer();
          });
      } else {
        // Fallback for Safari iOS / mobile devices without API
        setIsFullscreen(true);
        setFullscreenBanner(true);
        if (fullscreenBannerTimerRef.current) clearTimeout(fullscreenBannerTimerRef.current);
        fullscreenBannerTimerRef.current = setTimeout(() => setFullscreenBanner(false), 2000);
        resetInactivityTimer();
      }
    } else {
      if (exitFs) {
        exitFs.call(document)
          .then(() => {
            setIsFullscreen(false);
          })
          .catch(err => {
            console.warn('Native exitFullscreen failed, falling back to CSS:', err);
            setIsFullscreen(false);
          });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  const exitFullscreen = () => {
    const exitFs = document.exitFullscreen || 
                   (document as any).webkitExitFullscreen || 
                   (document as any).msExitFullscreen || 
                   (document as any).mozCancelFullScreen;

    const getFsElement = () => document.fullscreenElement || 
                              (document as any).webkitFullscreenElement || 
                              (document as any).msFullscreenElement || 
                              (document as any).mozFullscreenElement;

    if (getFsElement()) {
      if (exitFs) {
        exitFs.call(document).catch(err => console.warn('exitFullscreen failed:', err));
      }
    }
    setIsFullscreen(false);
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
            onClick={() => {
              exitFullscreen();
              onClose();
            }} 
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
          handleViewportClick(e.clientX, e.target as HTMLElement);
        }}
        onMouseLeave={handleMouseLeave}
      >
        {/* Invisible Hit Zones for Navigating */}
        <div className="reader-hit-zones">
          <div className="hit-zone prev-zone">
            <div className={`hover-chevron left-chevron ${hoveredZone === 'left' ? 'visible' : ''}`}>
              <ChevronLeft size={36} />
            </div>
          </div>
          <div className="hit-zone center-zone" />
          <div className="hit-zone next-zone">
            <div className={`hover-chevron right-chevron ${hoveredZone === 'right' ? 'visible' : ''}`}>
              <ChevronRight size={36} />
            </div>
          </div>
        </div>

        {/* Page Turn Animation Overlay */}
        {animatingState && (
          <div 
            className={`page-turn-overlay ${animatingState.type} ${animatingState.direction}`}
            style={{
              backgroundColor: getOverlayBg(activeTheme.bg, animatingState.type === 'curl'),
              animationDuration: `${animatingState.type === 'slide' ? 180 : (window.innerWidth <= 768 ? 600 : 750)}ms`,
              ['--anim-duration' as any]: `${animatingState.type === 'slide' ? 180 : (window.innerWidth <= 768 ? 600 : 750)}ms`
            } as React.CSSProperties}
          >
            {animatingState.type === 'curl' && (
              <>
                <div className="curl-edge-left" />
                <div className="curl-edge-right" />
              </>
            )}
          </div>
        )}
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

            {/* Nav Overlays / Hit Zones removed for absolute width-ratio zones */}
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
          <div 
            className="appearance-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
          >
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

              {/* Page turn animation selection */}
              <div className="settings-group">
                <span className="settings-label">Page Transition</span>
                <div className="setting-options-row">
                  {(['none', 'slide', 'curl'] as const).map(anim => (
                    <button 
                      key={anim}
                      onClick={() => updateSetting('animation', anim)}
                      className={`option-chip ${settings.animation === anim ? 'active' : ''}`}
                      aria-label={`${anim} page transition`}
                      style={{ borderColor: activeTheme.border, backgroundColor: activeTheme.bg }}
                    >
                      {anim.charAt(0).toUpperCase() + anim.slice(1)}
                    </button>
                  ))}
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

        /* Fullscreen Mode Layout Enhancements */
        .reader-overlay.fullscreen .reader-body {
          padding: 0 !important;
        }

        .reader-overlay.fullscreen .canvas-wrapper {
          max-width: 100% !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .reader-overlay.fullscreen .pdf-canvas-container {
          padding: 0 !important;
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

        /* Subtle hover chevrons for desktop */
        .hover-chevron {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 15;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          border-radius: var(--radius-full);
          background-color: rgba(0, 0, 0, 0.03);
          color: inherit;
        }

        .theme-dark .hover-chevron {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .left-chevron {
          left: 2rem;
          transform: translateY(-50%) translateX(-10px);
        }

        .right-chevron {
          right: 2rem;
          transform: translateY(-50%) translateX(10px);
        }

        .left-chevron.visible {
          opacity: 0.35;
          transform: translateY(-50%) translateX(0);
        }

        .right-chevron.visible {
          opacity: 0.35;
          transform: translateY(-50%) translateX(0);
        }

        /* Nav Overlays / Hit Zones */
        .reader-hit-zones {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          pointer-events: none;
          z-index: 10;
        }

        .hit-zone {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .prev-zone {
          width: 28%;
        }

        .center-zone {
          width: 44%;
        }

        .next-zone {
          width: 28%;
        }

        @media (max-width: 768px) {
          .prev-zone {
            width: 32%;
          }

          .center-zone {
            width: 36%;
          }

          .next-zone {
            width: 32%;
          }

          .hover-chevron {
            display: none !important;
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

        /* Page Turn Animation Overlays */
        .page-turn-overlay {
          position: absolute;
          top: 0;
          bottom: 0;
          height: 100%;
          z-index: 25;
          pointer-events: none;
        }

        /* Slide Animation styles */
        .page-turn-overlay.slide.next {
          left: 0;
          width: 100%;
          transform: translateX(100%);
          box-shadow: -10px 0 25px rgba(0, 0, 0, 0.15);
          animation: slide-next 180ms ease-in-out forwards;
        }

        .page-turn-overlay.slide.prev {
          left: 0;
          width: 100%;
          transform: translateX(-100%);
          box-shadow: 10px 0 25px rgba(0, 0, 0, 0.15);
          animation: slide-prev 180ms ease-in-out forwards;
        }

        @keyframes slide-next {
          0% { transform: translateX(100%); }
          55% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }

        @keyframes slide-prev {
          0% { transform: translateX(-100%); }
          55% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }

        /* Page Curl Animation styles */
        .page-turn-overlay.curl.next {
          right: 0;
          width: 100%;
          transform-origin: right center;
          transform: scaleX(0);
          box-shadow: -10px 0 25px rgba(0, 0, 0, 0.15);
          animation: curl-next var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        .page-turn-overlay.curl.prev {
          left: 0;
          width: 100%;
          transform-origin: left center;
          transform: scaleX(0);
          box-shadow: 10px 0 25px rgba(0, 0, 0, 0.15);
          animation: curl-prev var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        .curl-edge-left, .curl-edge-right {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 50px;
          height: 100%;
          pointer-events: none;
          opacity: 0;
        }

        .curl.next .curl-edge-left {
          left: 0;
          transform: translateX(-100%);
          background: linear-gradient(to right, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.2) 40%, 
            rgba(0,0,0,0.3) 60%, 
            rgba(255,255,255,0.4) 80%, 
            rgba(255,255,255,0.8) 100%
          );
          animation: edge-left-next-anim var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        .curl.next .curl-edge-right {
          right: 0;
          transform: translateX(100%);
          background: linear-gradient(to left, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.2) 40%, 
            rgba(0,0,0,0.3) 60%, 
            rgba(255,255,255,0.4) 80%, 
            rgba(255,255,255,0.8) 100%
          );
          animation: edge-right-next-anim var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        .curl.prev .curl-edge-left {
          left: 0;
          transform: translateX(-100%);
          background: linear-gradient(to right, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.2) 40%, 
            rgba(0,0,0,0.3) 60%, 
            rgba(255,255,255,0.4) 80%, 
            rgba(255,255,255,0.8) 100%
          );
          animation: edge-left-prev-anim var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        .curl.prev .curl-edge-right {
          right: 0;
          transform: translateX(100%);
          background: linear-gradient(to left, 
            rgba(0,0,0,0) 0%, 
            rgba(0,0,0,0.2) 40%, 
            rgba(0,0,0,0.3) 60%, 
            rgba(255,255,255,0.4) 80%, 
            rgba(255,255,255,0.8) 100%
          );
          animation: edge-right-prev-anim var(--anim-duration, 750ms) cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
        }

        @keyframes curl-next {
          0% {
            transform-origin: right center;
            transform: scaleX(0) skewY(0deg);
          }
          12% {
            transform-origin: right center;
            transform: scaleX(0.08) skewY(-1deg);
          }
          45% {
            transform-origin: right center;
            transform: scaleX(1) skewY(0deg);
          }
          50% {
            transform-origin: left center;
            transform: scaleX(1) skewY(0deg);
          }
          88% {
            transform-origin: left center;
            transform: scaleX(0.08) skewY(1deg);
          }
          100% {
            transform-origin: left center;
            transform: scaleX(0) skewY(0deg);
          }
        }

        @keyframes curl-prev {
          0% {
            transform-origin: left center;
            transform: scaleX(0) skewY(0deg);
          }
          12% {
            transform-origin: left center;
            transform: scaleX(0.08) skewY(1deg);
          }
          45% {
            transform-origin: left center;
            transform: scaleX(1) skewY(0deg);
          }
          50% {
            transform-origin: right center;
            transform: scaleX(1) skewY(0deg);
          }
          88% {
            transform-origin: right center;
            transform: scaleX(0.08) skewY(-1deg);
          }
          100% {
            transform-origin: right center;
            transform: scaleX(0) skewY(0deg);
          }
        }

        @keyframes edge-left-next-anim {
          0% { opacity: 0; }
          12% { opacity: 1; }
          45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        @keyframes edge-right-next-anim {
          0%, 54% { opacity: 0; }
          55% { opacity: 1; }
          88% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes edge-right-prev-anim {
          0% { opacity: 0; }
          12% { opacity: 1; }
          45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        @keyframes edge-left-prev-anim {
          0%, 54% { opacity: 0; }
          55% { opacity: 1; }
          88% { opacity: 1; }
          100% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .reader-header,
          .reader-footer-nav,
          .appearance-panel,
          .hover-chevron,
          .page-turn-overlay {
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
