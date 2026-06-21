export interface ClassifierMetadata {
  title?: string;
  subject?: string | string[];
  keywords?: string;
  description?: string;
  filename?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Fiction': ['novel', 'story', 'tales', 'fiction', 'literature', 'romance', 'thriller', 'fantasy', 'mystery'],
  'Non-Fiction': ['nonfiction', 'essay', 'history', 'philosophy', 'psychology', 'society'],
  'Self-help': ['self help', 'habits', 'productivity', 'personal growth', 'mindset', 'motivation'],
  'Business': ['business', 'startup', 'management', 'leadership', 'finance', 'marketing'],
  'Academic': ['research', 'journal', 'thesis', 'textbook', 'study', 'science', 'paper'],
  'Spirituality': ['yoga', 'meditation', 'spirituality', 'dharma', 'vedanta', 'buddhism', 'religion'],
  'Design': ['ux', 'design', 'product design', 'typography', 'interface', 'usability'],
  'Technology': ['programming', 'ai', 'machine learning', 'software', 'computer', 'data'],
  'Biography': ['biography', 'memoir', 'autobiography', 'life of']
};

export function classifyBookCategory(metadata: ClassifierMetadata): string {
  const parts: string[] = [];
  
  if (metadata.title) parts.push(metadata.title);
  
  if (metadata.subject) {
    if (Array.isArray(metadata.subject)) {
      parts.push(...metadata.subject);
    } else {
      parts.push(metadata.subject);
    }
  }
  
  if (metadata.keywords) parts.push(metadata.keywords);
  if (metadata.description) parts.push(metadata.description);
  if (metadata.filename) parts.push(metadata.filename);
  
  const combinedText = parts.join(' ').toLowerCase();
  
  let bestCategory = 'Unknown';
  let maxScore = 0;
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (combinedText.includes(keyword)) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

export function extractIsbn(identifier: any): string | undefined {
  if (!identifier) return undefined;
  const idStr = typeof identifier === 'string' 
    ? identifier 
    : JSON.stringify(identifier);
  
  const cleanStr = idStr.replace(/[-\s]/g, '');
  const isbn13Match = cleanStr.match(/\b(97[89]\d{10})\b/);
  if (isbn13Match) return isbn13Match[1];
  
  const isbn10Match = cleanStr.match(/\b(\d{9}[\dX])\b/i);
  if (isbn10Match) return isbn10Match[1];
  
  const rawMatch = idStr.match(/isbn[a-z0-9]*[:\s=]+([0-9Xx-]{10,17})/i);
  if (rawMatch) {
    return rawMatch[1].replace(/[-\s]/g, '');
  }
  
  return undefined;
}
