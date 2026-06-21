export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

const STORAGE_KEY = 'library_user_session';

export const authService = {
  getCurrentUser(): User | null {
    const session = localStorage.getItem(STORAGE_KEY);
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  },

  login(email: string, name: string): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUser: User = {
          id: 'user_' + Math.random().toString(36).substr(2, 9),
          email,
          name,
          avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
        resolve(mockUser);
      }, 500); // Simulate network latency
    });
  },

  logout(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        resolve();
      }, 300);
    });
  },

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
};
