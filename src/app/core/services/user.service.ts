import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Observable } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'customer' | 'designer';
  displayName?: string;
  phoneNumber?: string;
  company?: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
  isActive: boolean;
  assignedOrders?: string[]; // For designers
}

export interface CreateUserProfileData {
  email: string;
  role: 'admin' | 'customer' | 'designer';
  displayName?: string;
  phoneNumber?: string;
  company?: string;
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
        displayName: data.displayName || '',
        phoneNumber: data.phoneNumber || '',
        company: data.company || '',
        photoURL: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        lastLoginAt: timestamp,
        isActive: true,
        ...(data.role === 'designer' && { assignedOrders: [] })
      };

      await this.firestoreService.setDocument<Omit<UserProfile, 'id'>>(
        this.USERS_COLLECTION,
        uid,
        userProfile
      );
    } catch (error) {
      console.error('Error creating user profile:', error);
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
      console.error('Error getting user profile:', error);
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
      console.error('Error updating user profile:', error);
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
      console.error('Error updating last login:', error);
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
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: 'admin' | 'customer' | 'designer'): Promise<UserProfile[]> {
    try {
      const { where } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<UserProfile>(
        this.USERS_COLLECTION,
        [where('role', '==', role), where('isActive', '==', true)]
      );
    } catch (error) {
      console.error('Error getting users by role:', error);
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
      console.error('Error deactivating user:', error);
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
      console.error('Error activating user:', error);
      throw error;
    }
  }

  /**
   * Assign order to designer
   */
  async assignOrderToDesigner(designerUid: string, orderId: string): Promise<void> {
    try {
      const designer = await this.getUserProfile(designerUid);

      if (!designer) {
        throw new Error('Designer not found');
      }

      if (designer.role !== 'designer') {
        throw new Error('User is not a designer');
      }

      const currentOrders = designer.assignedOrders || [];

      if (!currentOrders.includes(orderId)) {
        await this.firestoreService.updateDocument(
          this.USERS_COLLECTION,
          designerUid,
          { assignedOrders: [...currentOrders, orderId] }
        );
      }
    } catch (error) {
      console.error('Error assigning order to designer:', error);
      throw error;
    }
  }

  /**
   * Remove order from designer
   */
  async removeOrderFromDesigner(designerUid: string, orderId: string): Promise<void> {
    try {
      const designer = await this.getUserProfile(designerUid);

      if (!designer) {
        throw new Error('Designer not found');
      }

      const currentOrders = designer.assignedOrders || [];
      const updatedOrders = currentOrders.filter(id => id !== orderId);

      await this.firestoreService.updateDocument(
        this.USERS_COLLECTION,
        designerUid,
        { assignedOrders: updatedOrders }
      );
    } catch (error) {
      console.error('Error removing order from designer:', error);
      throw error;
    }
  }
}
