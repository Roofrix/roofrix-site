// User interface for Firebase Authentication
export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
}

// Authentication state interface
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
