export interface ReadingProgress {
  bookId: string;
  progress: number; // 0 to 100
  lastRead: string; // ISO Date
  cfi?: string; // For EPUB position
  page?: number; // For PDF position
}

const STORAGE_KEY_PREFIX = 'library_progress_';

export const progressService = {
  getProgress(bookId: string): ReadingProgress {
    const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${bookId}`);
    if (!data) {
      return {
        bookId,
        progress: 0,
        lastRead: new Date().toISOString()
      };
    }
    try {
      return JSON.parse(data);
    } catch {
      return {
        bookId,
        progress: 0,
        lastRead: new Date().toISOString()
      };
    }
  },

  saveProgress(
    bookId: string,
    progress: number,
    details?: { cfi?: string; page?: number }
  ): ReadingProgress {
    const current = this.getProgress(bookId);
    const updated: ReadingProgress = {
      bookId,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      lastRead: new Date().toISOString(),
      cfi: details?.cfi ?? current.cfi,
      page: details?.page ?? current.page,
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${bookId}`, JSON.stringify(updated));
    return updated;
  },

  deleteProgress(bookId: string): void {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${bookId}`);
  },

  getAllProgress(): ReadingProgress[] {
    const progressList: ReadingProgress[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            progressList.push(JSON.parse(val));
          }
        } catch {
          // ignore corrupted data
        }
      }
    }
    return progressList.sort((a, b) => new Date(b.lastRead).getTime() - new Date(a.lastRead).getTime());
  }
};
