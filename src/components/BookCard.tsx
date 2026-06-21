import React from 'react';
import { FileText, Book } from 'lucide-react';
import type { Book as BookType } from '../services/metadataService';

interface BookCardProps {
  book: BookType;
  progress: number; // 0 to 100
  coverUrl?: string;
  onClick: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, progress, coverUrl, onClick }) => {
  return (
    <div className="book-card" onClick={onClick}>
      <div 
        className="book-cover-container"
        style={{
          background: coverUrl ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${book.coverGradientStart}, ${book.coverGradientEnd})`
        }}
      >
        {coverUrl && (
          <img src={coverUrl} alt={book.title} className="real-book-cover" />
        )}

        <div className="cover-format-badge">
          {book.format === 'epub' ? (
            <Book size={12} className="format-icon" />
          ) : (
            <FileText size={12} className="format-icon" />
          )}
          <span>{book.format.toUpperCase()}</span>
        </div>

        {!coverUrl && (
          <div className="cover-main">
            <h3 className="cover-title">{book.title}</h3>
            <p className="cover-author">{book.author}</p>
          </div>
        )}

        {!coverUrl && (
          <div className="cover-footer">
            <span className="cover-brand">LIBRARY</span>
          </div>
        )}
      </div>

      <div className="book-details">
        <h4 className="book-title-text">{book.title}</h4>
        <p className="book-author-text">{book.author}</p>

        <div className="book-card-meta-row">
          <span className="category-badge">{book.category || 'Unknown'}</span>
        </div>

        {progress > 0 ? (
          <div className="book-progress-section">
            <div className="book-progress-bar">
              <div 
                className="book-progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="book-progress-text">{progress}% read</span>
          </div>
        ) : (
          <span className="book-unread-tag">Unread</span>
        )}
      </div>

      <style>{`
        .book-card {
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform var(--transition-slow);
        }

        .book-card:hover {
          transform: translateY(-4px);
        }

        .book-card:hover .book-cover-container {
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.25);
        }

        /* Cover Inner layout */
        .cover-format-badge {
          align-self: flex-start;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background-color: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(4px);
          color: #FFFFFF;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.25rem 0.5rem;
          border-radius: var(--radius-sm);
          z-index: 5;
        }

        .format-icon {
          stroke-width: 2.5px;
        }

        .real-book-cover {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
        }

        .cover-main {
          margin-top: auto;
          margin-bottom: auto;
          text-align: center;
          padding: 0 0.5rem;
          z-index: 5;
          color: #121212; /* Dark text on gradient */
        }

        .cover-title {
          font-family: var(--font-serif);
          font-size: 1.1rem;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 0.25rem;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cover-author {
          font-size: 0.75rem;
          font-weight: 500;
          opacity: 0.75;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .cover-footer {
          text-align: center;
          z-index: 5;
          letter-spacing: 2px;
          font-size: 0.6rem;
          font-weight: 700;
          opacity: 0.4;
          color: #121212;
        }

        /* Details info styling */
        .book-details {
          padding-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .book-title-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .book-author-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .book-progress-section {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .book-progress-bar {
          flex: 1;
          height: 4px;
          background-color: var(--border-color);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .book-progress-fill {
          height: 100%;
          background-color: var(--accent);
          border-radius: var(--radius-full);
        }

        .book-progress-text {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .book-unread-tag {
          align-self: flex-start;
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--text-tertiary);
          margin-top: 0.25rem;
        }

        .book-card-meta-row {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
          margin-bottom: 0.15rem;
        }

        .category-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          align-self: flex-start;
          line-height: 1;
        }
      `}</style>
    </div>
  );
};
