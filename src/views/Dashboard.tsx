import React, { useState, useEffect } from 'react';
import { Search, Upload, BookOpen, Clock, Grid, List as ListIcon, ShieldAlert, Loader2 } from 'lucide-react';
import type { Book } from '../services/metadataService';
import type { ReadingProgress } from '../services/progressService';
import { BookCard } from '../components/BookCard';

const CATEGORIES = [
  'Fiction',
  'Non-Fiction',
  'Self-help',
  'Business',
  'Academic',
  'Spirituality',
  'Design',
  'Technology',
  'Biography',
  'Unknown'
];

interface DashboardProps {
  books: Book[];
  progressMap: Record<string, ReadingProgress>;
  covers: Record<string, string>;
  onSelectBook: (book: Book) => void;
  onOpenUpload: () => void;
  onRefreshCovers: () => void;
  refreshingCovers: boolean;
}

type FilterType = 'all' | 'epub' | 'pdf';
type LayoutType = 'grid' | 'list';

export const Dashboard: React.FC<DashboardProps> = ({
  books,
  progressMap,
  covers,
  onSelectBook,
  onOpenUpload,
  onRefreshCovers,
  refreshingCovers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutType>('grid');

  // 1. Get in-progress books (0 < progress < 100) sorted by last read
  const inProgressBooks = books
    .filter(book => {
      const prog = progressMap[book.id]?.progress || 0;
      return prog > 0 && prog < 100;
    })
    .sort((a, b) => {
      const timeA = new Date(progressMap[a.id]?.lastRead || 0).getTime();
      const timeB = new Date(progressMap[b.id]?.lastRead || 0).getTime();
      return timeB - timeA;
    });

  // 2. Recently added books check is omitted in view rendition

  // 3. Filtered book list for "All Books" grid
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormat = formatFilter === 'all' || book.format === formatFilter;
    const matchesCategory = !selectedCategory || (book.category || 'Unknown') === selectedCategory;
    return matchesSearch && matchesFormat && matchesCategory;
  });

  const allCategoriesCount = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFormat = formatFilter === 'all' || book.format === formatFilter;
    return matchesSearch && matchesFormat;
  }).length;

  const getCategoryCount = (cat: string) => {
    return books.filter(book => {
      const matchesSearch = 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFormat = formatFilter === 'all' || book.format === formatFilter;
      const bookCat = book.category || 'Unknown';
      return matchesSearch && matchesFormat && bookCat === cat;
    }).length;
  };

  useEffect(() => {
    if (selectedCategory && getCategoryCount(selectedCategory) === 0) {
      setSelectedCategory(null);
    }
  }, [books, searchQuery, formatFilter, selectedCategory]);

  return (
    <div className="dashboard-view">
      {/* Welcome Banner */}
      <header className="dashboard-header">
        <div className="header-greeting">
          <h1>My Library</h1>
          <p className="security-announcement">
            <ShieldAlert size={14} className="security-icon" />
            <span>Private cloud sandbox: Books and progress are encrypted in your local browser cache.</span>
          </p>
        </div>
        <div className="dashboard-header-actions">
          {books.length > 0 && (
            <button 
              className="btn btn-secondary" 
              onClick={onRefreshCovers}
              disabled={refreshingCovers}
            >
              {refreshingCovers ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Refreshing...</span>
                </>
              ) : (
                <span>Refresh Covers</span>
              )}
            </button>
          )}
          <button className="btn btn-primary" onClick={onOpenUpload}>
            <Upload size={18} />
            <span>Upload Book</span>
          </button>
        </div>
      </header>

      {/* Continue Reading Section */}
      {inProgressBooks.length > 0 && (
        <section className="dashboard-section animate-fade-in">
          <div className="section-title-container">
            <Clock size={18} className="section-icon text-accent" />
            <h2>Continue Reading</h2>
          </div>
          <div className="continue-reading-list">
            {inProgressBooks.map(book => {
              const prog = progressMap[book.id]?.progress || 0;
              return (
                <div 
                  key={book.id} 
                  className="continue-reading-card card" 
                  onClick={() => onSelectBook(book)}
                >
                  <div 
                    className="mini-cover"
                    style={{
                      background: covers[book.id] ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${book.coverGradientStart}, ${book.coverGradientEnd})`
                    }}
                  >
                    {covers[book.id] ? (
                      <img src={covers[book.id]} alt={book.title} className="mini-cover-img" />
                    ) : (
                      <span className="mini-cover-title">{book.title}</span>
                    )}
                  </div>
                  <div className="continue-reading-details">
                    <span className="format-tag-mini">{book.format.toUpperCase()}</span>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    <div className="mini-progress-row">
                      <div className="book-progress-bar">
                        <div className="book-progress-fill" style={{ width: `${prog}%` }}></div>
                      </div>
                      <span className="mini-progress-text">{prog}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Books Grid / List */}
      <section className="dashboard-section main-bookshelf-section">
        <div className="bookshelf-controls">
          <div className="section-title-container">
            <BookOpen size={18} className="section-icon text-accent" />
            <h2>All Books</h2>
            <span className="books-count-badge">{books.length}</span>
          </div>

          <div className="controls-actions">
            {/* Search Input */}
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search title, author..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Format Filter Tabs */}
            <div className="filter-tabs">
              <button 
                onClick={() => setFormatFilter('all')}
                className={`filter-tab-btn ${formatFilter === 'all' ? 'active' : ''}`}
              >
                All
              </button>
              <button 
                onClick={() => setFormatFilter('epub')}
                className={`filter-tab-btn ${formatFilter === 'epub' ? 'active' : ''}`}
              >
                EPUB
              </button>
              <button 
                onClick={() => setFormatFilter('pdf')}
                className={`filter-tab-btn ${formatFilter === 'pdf' ? 'active' : ''}`}
              >
                PDF
              </button>
            </div>

            {/* Layout Mode Toggle */}
            <div className="layout-toggle">
              <button 
                onClick={() => setLayoutMode('grid')}
                className={`layout-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button 
                onClick={() => setLayoutMode('list')}
                className={`layout-btn ${layoutMode === 'list' ? 'active' : ''}`}
                title="List View"
              >
                <ListIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Chips Filter */}
        {books.length > 0 && (
          <div className="category-filters-row">
            <button 
              className={`category-chip ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              <span>All Categories</span>
              <span className="category-chip-count">{allCategoriesCount}</span>
            </button>
            {CATEGORIES.map(cat => {
              const count = getCategoryCount(cat);
              if (count === 0) return null;
              return (
                <button 
                  key={cat}
                  className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <span>{cat}</span>
                  <span className="category-chip-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {books.length === 0 ? (
          <div className="empty-books-state card">
            <BookOpen size={48} className="empty-icon" />
            <h3>Your bookshelf is empty</h3>
            <p>
              Upload EPUB or PDF books to start building your personal library. Your files are stored safely in your browser.
            </p>
            <button className="btn btn-primary" onClick={onOpenUpload}>
              <Upload size={18} />
              <span>Upload your first book</span>
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="empty-search-state">
            <p>No books match your search or filter options.</p>
          </div>
        ) : layoutMode === 'grid' ? (
          <div className="books-grid">
            {filteredBooks.map(book => (
              <BookCard 
                key={book.id}
                book={book}
                progress={progressMap[book.id]?.progress || 0}
                coverUrl={covers[book.id]}
                onClick={() => onSelectBook(book)}
              />
            ))}
          </div>
        ) : (
          <div className="books-list-view">
            {filteredBooks.map(book => {
              const prog = progressMap[book.id]?.progress || 0;
              return (
                <div 
                  key={book.id} 
                  className="list-item-card card" 
                  onClick={() => onSelectBook(book)}
                >
                  <div 
                    className="list-item-cover"
                    style={{
                      background: covers[book.id] ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${book.coverGradientStart}, ${book.coverGradientEnd})`,
                      overflow: 'hidden'
                    }}
                  >
                    {covers[book.id] ? (
                      <img src={covers[book.id]} alt={book.title} className="list-item-cover-img" />
                    ) : (
                      <span>L</span>
                    )}
                  </div>
                  <div className="list-item-info">
                    <h3>{book.title}</h3>
                    <p>
                      {book.author}
                      <span className="list-item-category-badge">{book.category || 'Unknown'}</span>
                    </p>
                  </div>
                  <span className="list-item-format">{book.format.toUpperCase()}</span>
                  <div className="list-item-progress-col">
                    <div className="book-progress-bar">
                      <div className="book-progress-fill" style={{ width: `${prog}%` }}></div>
                    </div>
                    <span>{prog}% read</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        .dashboard-view {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          margin-top: 20px;
        }

        @media (max-width: 1024px) {
          .dashboard-view {
            margin-top: 60px; /* Spacer below mobile header */
            gap: 2rem;
          }
        }

        /* Header block */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
        }

        .dashboard-header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        @media (max-width: 600px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .dashboard-header-actions {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }
          .dashboard-header-actions .btn {
            width: 100%;
          }
        }

        .mini-cover-img,
        .list-item-cover-img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
        }

        .header-greeting h1 {
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 2.25rem;
          margin: 0 0 0.25rem;
          letter-spacing: -0.75px;
          color: var(--text-primary);
        }

        .security-announcement {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-sm);
          font-weight: 500;
        }

        .security-icon {
          color: var(--accent);
          flex-shrink: 0;
        }

        /* Dashboard Sections */
        .dashboard-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .section-title-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .section-icon {
          flex-shrink: 0;
        }

        .dashboard-section h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .books-count-badge {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
        }

        /* Continue reading carousel */
        .continue-reading-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .continue-reading-card {
          display: flex;
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          cursor: pointer;
        }

        .mini-cover {
          width: 50px;
          aspect-ratio: 2 / 3;
          border-radius: var(--radius-sm);
          position: relative;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
        }

        .mini-cover::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.2), transparent);
        }

        .mini-cover-title {
          font-family: var(--font-serif);
          font-size: 0.35rem;
          font-weight: 600;
          color: #121212;
          text-align: center;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .continue-reading-details {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          flex: 1;
          overflow: hidden;
        }

        .format-tag-mini {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--accent);
          align-self: flex-start;
        }

        .continue-reading-details h3 {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .continue-reading-details p {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mini-progress-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.35rem;
        }

        .mini-progress-text {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        /* Controls / Search bookshelf bar */
        .bookshelf-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .controls-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        @media (max-width: 600px) {
          .bookshelf-controls {
            flex-direction: column;
            align-items: flex-start;
          }
          .controls-actions {
            width: 100%;
            justify-content: space-between;
          }
          .search-bar {
            width: 100%;
          }
        }

        .search-bar {
          position: relative;
          min-width: 200px;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
        }

        .search-bar input {
          width: 100%;
          padding: 0.5rem 1rem 0.5rem 2.25rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          outline: none;
          font-size: 0.85rem;
          transition: all var(--transition-fast);
        }

        .search-bar input:focus {
          border-color: var(--border-focus);
          background-color: var(--bg-primary);
        }

        /* Filter Tab Buttons */
        .filter-tabs {
          display: flex;
          background-color: var(--bg-tertiary);
          padding: 0.25rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
        }

        .filter-tab-btn {
          padding: 0.35rem 0.85rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          transition: all var(--transition-fast);
        }

        .filter-tab-btn.active {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        /* Layout Grid/List Switcher */
        .layout-toggle {
          display: flex;
          gap: 0.15rem;
          background-color: var(--bg-tertiary);
          padding: 0.25rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }

        .layout-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .layout-btn.active {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        /* Grid layout */
        .books-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        @media (max-width: 480px) {
          .books-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 1rem;
          }
        }

        /* List Layout */
        .books-list-view {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .list-item-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
        }

        .list-item-cover {
          width: 32px;
          height: 48px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-serif);
          font-weight: 700;
          color: #121212;
          font-size: 0.6rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          position: relative;
        }

        .list-item-cover::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.25), transparent);
        }

        .list-item-info {
          flex: 2;
          overflow: hidden;
        }

        .list-item-info h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .list-item-info p {
          font-size: 0.8rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .list-item-format {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-secondary);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-sm);
        }

        .list-item-progress-col {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          min-width: 150px;
        }

        @media (max-width: 600px) {
          .list-item-card {
            gap: 0.75rem;
          }
          .list-item-progress-col {
            display: none;
          }
        }

        /* Empty shelf styling */
        .empty-books-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 2rem;
          text-align: center;
          gap: 1rem;
        }

        .empty-icon {
          color: var(--text-tertiary);
        }

        .empty-books-state h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .empty-books-state p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          max-width: 380px;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .empty-search-state {
          padding: 3rem 0;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* Category Chips Styling */
        .category-filters-row {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding: 0.25rem 0 1rem;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .category-filters-row::-webkit-scrollbar {
          display: none;
        }

        .category-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          padding: 0.35rem 0.85rem;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          transition: all var(--transition-fast);
        }

        .category-chip:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .category-chip.active {
          background-color: var(--accent);
          border-color: var(--accent);
          color: #FFFFFF;
        }

        .category-chip-count {
          font-size: 0.7rem;
          opacity: 0.85;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 0.05rem 0.35rem;
          border-radius: var(--radius-full);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .category-chip.active .category-chip-count {
          background-color: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
        }

        .list-item-category-badge {
          margin-left: 0.75rem;
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-sm);
          display: inline-block;
          line-height: 1.2;
        }
      `}</style>
    </div>
  );
};
