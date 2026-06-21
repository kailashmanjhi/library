export interface Book {
  id: string;
  title: string;
  author: string;
  format: 'epub' | 'pdf';
  sizeBytes: number;
  createdAt: string;
  coverGradientStart: string;
  coverGradientEnd: string;
  hasCover?: boolean;
  category: string;
  subjects?: string[];
  publisher?: string;
  language?: string;
  description?: string;
  isbn?: string;
}

const STORAGE_KEY = 'library_book_metadata';

const GRADIENTS = [
  { start: '#e0c3fc', end: '#8ec5fc' }, // Lavender Blue
  { start: '#fbc2eb', end: '#a6c1ee' }, // Pink Slate
  { start: '#fdcbf1', end: '#e6dee9' }, // Blossom Sepia
  { start: '#a1c4fd', end: '#c2e9fb' }, // Ice Blue
  { start: '#d4fc79', end: '#96e6a1' }, // Warm Green
  { start: '#fddb92', end: '#d1f2ff' }, // Sunset Ivory
  { start: '#f5f7fa', end: '#c3cfe2' }, // Calm Gray
];

export const metadataService = {
  getBooks(): Book[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return this.initializeDefaultBooks();
    try {
      const books = JSON.parse(data);
      let updated = false;
      books.forEach((b: any) => {
        if (!b.category) {
          b.category = 'Unknown';
          updated = true;
        }
      });
      if (updated) {
        this.saveBooks(books);
      }
      return books;
    } catch {
      return [];
    }
  },

  initializeDefaultBooks(): Book[] {
    // Start with empty to respect "no copyrighted sample books",
    // but we can create one local Welcome Guide.
    const defaultBooks: Book[] = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultBooks));
    return defaultBooks;
  },

  saveBooks(books: Book[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  },

  addBook(
    title: string, 
    author: string, 
    format: 'epub' | 'pdf', 
    sizeBytes: number, 
    hasCover = false,
    extMeta?: {
      category?: string;
      subjects?: string[];
      publisher?: string;
      language?: string;
      description?: string;
      isbn?: string;
    }
  ): Book {
    const books = this.getBooks();
    
    // Choose a random gradient for the cover
    const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

    const newBook: Book = {
      id: 'book_' + Math.random().toString(36).substr(2, 9),
      title: title || 'Untitled Book',
      author: author || 'Unknown Author',
      format,
      sizeBytes,
      createdAt: new Date().toISOString(),
      coverGradientStart: gradient.start,
      coverGradientEnd: gradient.end,
      hasCover,
      category: extMeta?.category || 'Unknown',
      subjects: extMeta?.subjects || [],
      publisher: extMeta?.publisher,
      language: extMeta?.language,
      description: extMeta?.description,
      isbn: extMeta?.isbn
    };

    books.push(newBook);
    this.saveBooks(books);
    return newBook;
  },

  updateBookCover(bookId: string, hasCover: boolean): void {
    const books = this.getBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
      book.hasCover = hasCover;
      this.saveBooks(books);
    }
  },

  updateBookCategory(bookId: string, category: string): void {
    const books = this.getBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
      book.category = category;
      this.saveBooks(books);
    }
  },

  deleteBook(bookId: string): void {
    const books = this.getBooks();
    const updated = books.filter(b => b.id !== bookId);
    this.saveBooks(updated);
  },

  getStorageStats(limitBytes: number = 5 * 1024 * 1024 * 1024): { used: number; limit: number; percent: number } {
    const books = this.getBooks();
    const used = books.reduce((acc, book) => acc + book.sizeBytes, 0);
    return {
      used,
      limit: limitBytes,
      percent: Math.min(100, (used / limitBytes) * 100)
    };
  }
};
