import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  getAuth,
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  UserCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { User } from '../models/user.interface';
import { getFirebaseErrorMessage } from '../utils/validators';
import { UserService } from './user.service';
import { PricingService } from './pricing.service';
import { FirebaseAppService } from './firebase-app.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private userService = inject(UserService);
  private pricingService = inject(PricingService);
  private firebaseAppService = inject(FirebaseAppService);
  private auth: Auth;

  // Observable to track current user
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  // Observable to track authentication state
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(true);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  constructor() {
    this.auth = getAuth(this.firebaseAppService.app);

    // Listen to auth state changes
    this.initAuthStateListener();
  }

  /**
   * Initialize authentication state listener
   */
  private initAuthStateListener(): void {
    onAuthStateChanged(this.auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified
        };
        this.currentUserSubject.next(user);
        this.isAuthenticatedSubject.next(true);
        if (firebaseUser.emailVerified) {
          this.pricingService.loadPricing();
        }
      } else {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
      this.loadingSubject.next(false);
    });
  }

  /**
   * Sign up a new user with email and password
   * Also creates a Firestore user profile with 'customer' role by default
   */
  signUp(email: string, password: string, name: string): Observable<{ success: boolean; error?: string; uid?: string }> {
    this.loadingSubject.next(true);

    return from(createUserWithEmailAndPassword(this.auth, email.trim(), password)).pipe(
      switchMap(async (credential: UserCredential) => {
        try {
          // Create Firestore user profile
          await this.userService.createUserProfile(credential.user.uid, {
            email: credential.user.email || email.trim(),
            role: 'customer', // Default role for new signups
            name: name.trim()
          });

          // Send verification email
          await sendEmailVerification(credential.user);

          // Sign out so user can't access protected routes before verifying
          await signOut(this.auth);

          this.loadingSubject.next(false);
          return { success: true, uid: credential.user.uid };
        } catch (firestoreError) {
          this.loadingSubject.next(false);
          // Auth succeeded but Firestore profile creation failed
          return {
            success: false,
            error: 'Account created but profile setup failed. Please contact support.',
            uid: credential.user.uid
          };
        }
      }),
      catchError((error) => {
        this.loadingSubject.next(false);
        const errorMessage = getFirebaseErrorMessage(error.code);
        return of({ success: false, error: errorMessage });
      })
    );
  }

  /**
   * Sign in an existing user with email and password
   * Updates last login timestamp in Firestore
   */
  signIn(email: string, password: string): Observable<{ success: boolean; error?: string }> {
    this.loadingSubject.next(true);

    return from(signInWithEmailAndPassword(this.auth, email.trim(), password)).pipe(
      switchMap(async (credential: UserCredential) => {
        // Check email verification before allowing access
        if (!credential.user.emailVerified) {
          await signOut(this.auth);
          this.loadingSubject.next(false);
          return { success: false, error: 'Please verify your email before signing in. Check your inbox for the verification link.' };
        }

        try {
          // Update last login timestamp
          await this.userService.updateLastLogin(credential.user.uid);
          this.loadingSubject.next(false);
          return { success: true };
        } catch (firestoreError) {
          // Sign in succeeded, non-critical error
          this.loadingSubject.next(false);
          return { success: true };
        }
      }),
      catchError((error: any) => {
        this.loadingSubject.next(false);
        const errorMessage = getFirebaseErrorMessage(error?.code || 'unknown');
        return of({ success: false, error: errorMessage });
      })
    );
  }

  /**
   * Sign out the current user
   */
  signOutUser(): Observable<{ success: boolean; error?: string }> {
    return from(signOut(this.auth)).pipe(
      map(() => {
        this.router.navigate(['/']);
        return { success: true };
      }),
      catchError((error) => {
        const errorMessage = 'Failed to sign out. Please try again.';
        return of({ success: false, error: errorMessage });
      })
    );
  }

  /**
   * Get the current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Resend verification email by temporarily signing in
   */
  resendVerificationEmail(email: string, password: string): Observable<{ success: boolean; error?: string }> {
    return from(signInWithEmailAndPassword(this.auth, email.trim(), password)).pipe(
      switchMap(async (credential: UserCredential) => {
        await sendEmailVerification(credential.user);
        await signOut(this.auth);
        return { success: true };
      }),
      catchError((error) => {
        return of({ success: false, error: getFirebaseErrorMessage(error?.code || 'unknown') });
      })
    );
  }

  /**
   * Send password reset email
   */
  forgotPassword(email: string): Observable<{ success: boolean; error?: string }> {
    return from(sendPasswordResetEmail(this.auth, email.trim())).pipe(
      map(() => ({ success: true })),
      catchError((error) => {
        return of({ success: false, error: getFirebaseErrorMessage(error?.code || 'unknown') });
      })
    );
  }

  /**
   * Check if authentication is loading
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }
}
