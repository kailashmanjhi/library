const DB_NAME = 'library_local_storage';
const DB_VERSION = 1;
const STORE_NAME = 'book_blobs';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const storageService = {
  /**
   * Saves a book file (Blob/File) to IndexedDB
   */
  async saveBookFile(bookId: string, fileBlob: Blob): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fileBlob, bookId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Retrieves a book file Blob from IndexedDB
   */
  async getBookFile(bookId: string): Promise<Blob | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Deletes a book file from IndexedDB
   */
  async deleteBookFile(bookId: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Generates a temporary object URL for a book file in IndexedDB
   * Make sure to revoke this URL when done reading to avoid memory leaks.
   */
  async getBookUrl(bookId: string): Promise<string | null> {
    const blob = await this.getBookFile(bookId);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },

  /**
   * Helper to revoke object URL
   */
  revokeBookUrl(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  },

  /**
   * Saves a book cover Blob to IndexedDB
   */
  async saveBookCover(bookId: string, coverBlob: Blob): Promise<void> {
    return this.saveBookFile(`cover_${bookId}`, coverBlob);
  },

  /**
   * Retrieves a book cover Blob URL from IndexedDB
   */
  async getBookCoverUrl(bookId: string): Promise<string | null> {
    return this.getBookUrl(`cover_${bookId}`);
  },

  /**
   * Deletes a book cover from IndexedDB
   */
  async deleteBookCover(bookId: string): Promise<void> {
    return this.deleteBookFile(`cover_${bookId}`);
  }
};
