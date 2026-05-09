import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Observable } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'customer';
  name?: string;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
  isActive: boolean;
}

export interface CreateUserProfileData {
  email: string;
  role: 'admin' | 'customer';
  name?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestoreService = inject(FirestoreService);
  private readonly USERS_COLLECTION = 'users';

  /**
   * Create a new user profile in Firestore
   * Called after successful Firebase Authentication signup
   */
  async createUserProfile(
    uid: string,
    data: CreateUserProfileData
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();

      const userProfile: Omit<UserProfile, 'id'> = {
        email: data.email,
        role: data.role,
        name: data.name || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastLoginAt: timestamp,
        isActive: true,
      };

      await this.firestoreService.setDocument<Omit<UserProfile, 'id'>>(
        this.USERS_COLLECTION,
        uid,
        userProfile
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      return await this.firestoreService.getDocument<UserProfile>(
        this.USERS_COLLECTION,
        uid
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    uid: string,
    data: Partial<UserProfile>
  ): Promise<void> {
    try {
      // Remove fields that shouldn't be updated directly
      const { id, createdAt, ...updateData } = data;

      await this.firestoreService.updateDocument(
        this.USERS_COLLECTION,
        uid,
        updateData
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(uid: string): Promise<void> {
    try {
      await this.firestoreService.updateDocument(
        this.USERS_COLLECTION,
        uid,
        { lastLoginAt: this.firestoreService.getTimestamp() }
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Real-time listener for user profile
   */
  userProfileListener(uid: string): Observable<UserProfile | null> {
    return this.firestoreService.documentListener<UserProfile>(
      this.USERS_COLLECTION,
      uid
    );
  }

  /**
   * Get all users (Admin only)
   */
  async getAllUsers(): Promise<UserProfile[]> {
    try {
      return await this.firestoreService.getDocuments<UserProfile>(
        this.USERS_COLLECTION
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: 'admin' | 'customer'): Promise<UserProfile[]> {
    try {
      const { where } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<UserProfile>(
        this.USERS_COLLECTION,
        [where('role', '==', role), where('isActive', '==', true)]
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(uid: string): Promise<void> {
    try {
      await this.firestoreService.updateDocument(
        this.USERS_COLLECTION,
        uid,
        { isActive: false }
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Activate user account
   */
  async activateUser(uid: string): Promise<void> {
    try {
      await this.firestoreService.updateDocument(
        this.USERS_COLLECTION,
        uid,
        { isActive: true }
      );
    } catch (error) {
      throw error;
    }
  }

}
