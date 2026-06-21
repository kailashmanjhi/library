import React, { useState } from 'react';
import { X, Book, FileText, Calendar, HardDrive, Trash2, BookOpen, AlertTriangle, Tag, Globe, Building, Hash } from 'lucide-react';
import type { Book as BookType } from '../services/metadataService';

interface BookDetailsModalProps {
  book: BookType;
  progress: number;
  coverUrl?: string;
  onClose: () => void;
  onRead: () => void;
  onDelete: () => void;
  onUpdateCategory: (bookId: string, category: string) => void;
}

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

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  book,
  progress,
  coverUrl,
  onClose,
  onRead,
  onDelete,
  onUpdateCategory
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format Date helper
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="details-modal-header">
          <button className="details-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="details-modal-body">
          {!confirmDelete ? (
            <>
              <div className="details-top-info">
                <div 
                  className="details-cover-preview"
                  style={{
                    background: coverUrl ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${book.coverGradientStart}, ${book.coverGradientEnd})`
                  }}
                >
                  {coverUrl && (
                    <img src={coverUrl} alt={book.title} className="details-real-cover" />
                  )}
                  {!coverUrl && <h3 className="details-cover-title">{book.title}</h3>}
                  {!coverUrl && <p className="details-cover-author">{book.author}</p>}
                  {!coverUrl && <span className="details-cover-brand">LIBRARY</span>}
                </div>

                <div className="details-text-meta">
                  <span className="details-format-tag">
                    {book.format === 'epub' ? <Book size={12} /> : <FileText size={12} />}
                    {book.format.toUpperCase()}
                  </span>
                  <h2 className="details-title">{book.title}</h2>
                  <p className="details-author">by {book.author}</p>

                  <div className="details-progress-circle-section">
                    <div className="progress-bar-container large">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="details-progress-label">
                      {progress > 0 ? `${progress}% completed` : 'Unread'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="details-metadata-grid">
                <div className="meta-grid-item">
                  <Calendar size={16} className="meta-icon" />
                  <div className="meta-label-group">
                    <span className="meta-label">Added On</span>
                    <span className="meta-value">{formatDate(book.createdAt)}</span>
                  </div>
                </div>

                <div className="meta-grid-item">
                  <HardDrive size={16} className="meta-icon" />
                  <div className="meta-label-group">
                    <span className="meta-label">File Size</span>
                    <span className="meta-value">{formatBytes(book.sizeBytes)}</span>
                  </div>
                </div>

                <div className="meta-grid-item">
                  <Tag size={16} className="meta-icon" />
                  <div className="meta-label-group">
                    <span className="meta-label">Category</span>
                    <select 
                      className="category-select"
                      value={book.category || 'Unknown'}
                      onChange={(e) => onUpdateCategory(book.id, e.target.value)}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {book.language && (
                  <div className="meta-grid-item">
                    <Globe size={16} className="meta-icon" />
                    <div className="meta-label-group">
                      <span className="meta-label">Language</span>
                      <span className="meta-value">{book.language.toUpperCase()}</span>
                    </div>
                  </div>
                )}

                {book.publisher && (
                  <div className="meta-grid-item">
                    <Building size={16} className="meta-icon" />
                    <div className="meta-label-group">
                      <span className="meta-label">Publisher</span>
                      <span className="meta-value">{book.publisher}</span>
                    </div>
                  </div>
                )}

                {book.isbn && (
                  <div className="meta-grid-item">
                    <Hash size={16} className="meta-icon" />
                    <div className="meta-label-group">
                      <span className="meta-label">ISBN</span>
                      <span className="meta-value">{book.isbn}</span>
                    </div>
                  </div>
                )}
              </div>

              {book.description && (
                <div className="details-description-section">
                  <h4>Description</h4>
                  <p>{book.description}</p>
                </div>
              )}

              {book.subjects && book.subjects.length > 0 && (
                <div className="details-subjects-section">
                  <h4>Subjects</h4>
                  <div className="subjects-badges-container">
                    {book.subjects.map((sub, index) => (
                      <span key={index} className="subject-badge">{sub}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="details-action-buttons">
                <button className="btn btn-primary flex-1" onClick={onRead}>
                  <BookOpen size={18} />
                  <span>Read Book</span>
                </button>
                <button 
                  className="btn btn-secondary delete-trigger-btn"
                  onClick={() => setConfirmDelete(true)}
                  title="Remove from Shelf"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="delete-confirm-container">
              <AlertTriangle size={48} className="delete-warning-icon" />
              <h3>Remove from Shelf?</h3>
              <p className="delete-warning-text">
                Are you sure you want to delete <strong>“{book.title}”</strong>? This action will permanently erase the book file and your reading progress from this browser.
              </p>
              <div className="delete-confirm-buttons">
                <button className="btn btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary delete-final-btn flex-1" onClick={onDelete}>
                  <Trash2 size={18} />
                  <span>Permanently Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .details-modal-header {
          display: flex;
          justify-content: flex-end;
          padding: 1rem 1rem 0;
        }

        .details-close-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-full);
          color: var(--text-secondary);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
        }

        .details-close-btn:hover {
          background-color: var(--border-color);
          color: var(--text-primary);
        }

        .details-modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .details-top-info {
          display: flex;
          gap: 1.5rem;
        }

        @media (max-width: 600px) {
          .details-top-info {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
        }

        .details-cover-preview {
          width: 140px;
          aspect-ratio: 2 / 3;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1rem;
          color: #121212;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }

        .details-real-cover {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
        }

        .details-cover-preview::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 6px;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.02) 50%, rgba(255, 255, 255, 0.08) 100%);
          z-index: 2;
        }

        .details-cover-title {
          font-family: var(--font-serif);
          font-size: 0.85rem;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 0.25rem;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .details-cover-author {
          font-size: 0.65rem;
          opacity: 0.8;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .details-cover-brand {
          text-align: center;
          letter-spacing: 1.5px;
          font-size: 0.5rem;
          font-weight: 700;
          opacity: 0.4;
        }

        .details-text-meta {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
        }

        .details-format-tag {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background-color: var(--accent-light);
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.6rem;
          border-radius: var(--radius-sm);
          margin-bottom: 0.75rem;
        }

        @media (max-width: 600px) {
          .details-format-tag {
            align-self: center;
          }
        }

        .details-title {
          font-family: var(--font-serif);
          font-size: 1.5rem;
          line-height: 1.25;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .details-author {
          font-size: 0.95rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .details-progress-circle-section {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .progress-bar-container.large {
          height: 8px;
          background-color: var(--border-color);
          border-radius: var(--radius-full);
          width: 100%;
        }

        .details-progress-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        /* Metadata Grid */
        .details-metadata-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          padding: 1rem 0;
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        .meta-grid-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
        }

        .meta-icon {
          color: var(--text-tertiary);
          flex-shrink: 0;
        }

        .meta-label-group {
          display: flex;
          flex-direction: column;
          line-height: 1.3;
          overflow: hidden;
        }

        .meta-label {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .meta-value {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .category-select {
          border: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-sm);
          outline: none;
          cursor: pointer;
          transition: border-color var(--transition-fast);
          max-width: 140px;
        }

        .category-select:focus {
          border-color: var(--border-focus);
        }

        .details-description-section {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }

        .details-description-section h4,
        .details-subjects-section h4 {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0;
        }

        .details-description-section p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .details-subjects-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }

        .subjects-badges-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .subject-badge {
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--text-secondary);
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
        }

        /* Buttons footer */
        .details-action-buttons {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .flex-1 {
          flex: 1;
        }

        .delete-trigger-btn {
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          padding: 0.75rem;
        }

        .delete-trigger-btn:hover {
          background-color: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.3);
          color: #EF4444;
        }

        /* Delete Confirm Section */
        .delete-confirm-container {
          text-align: center;
          padding: 1rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .delete-warning-icon {
          color: #F59E0B;
        }

        .delete-confirm-container h3 {
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .delete-warning-text {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
          max-width: 400px;
        }

        .delete-confirm-buttons {
          display: flex;
          gap: 0.75rem;
          width: 100%;
          margin-top: 0.5rem;
        }

        .delete-final-btn {
          background-color: #EF4444 !important;
          color: #FFFFFF !important;
        }

        .delete-final-btn:hover {
          background-color: #DC2626 !important;
        }
      `}</style>
    </div>
  );
};
