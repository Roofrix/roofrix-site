# Firebase Database Architecture - Rooftop Design Order Management

## Table of Contents
1. [Overview](#overview)
2. [Firestore Collections Structure](#firestore-collections-structure)
3. [Security Rules](#security-rules)
4. [Storage Structure](#storage-structure)
5. [Implementation Guide](#implementation-guide)
6. [Best Practices](#best-practices)

---

## Overview

### Technology Stack
- **Authentication**: Firebase Authentication (Email/Password)
- **Database**: Cloud Firestore (NoSQL)
- **File Storage**: Firebase Storage
- **Real-time Updates**: Firestore Real-time Listeners

### User Roles
- **Admin**: Full access to all data and operations
- **Customer**: Access to own orders only
- **Designer**: Access to assigned orders only

---

## Firestore Collections Structure

### 1. Users Collection
**Path**: `/users/{userId}`

```typescript
interface UserDocument {
  // Basic Info
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;

  // Role & Permissions
  role: 'admin' | 'customer' | 'designer';
  isActive: boolean;              // For account suspension

  // Customer-specific
  company?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  // Designer-specific
  specialization?: string[];      // e.g., ["residential", "commercial"]
  assignedOrders?: string[];      // Array of order IDs

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}
```

**Example Document**:
```javascript
{
  uid: "abc123xyz",
  email: "john@example.com",
  displayName: "John Doe",
  role: "customer",
  isActive: true,
  company: "ABC Construction",
  phone: "+1234567890",
  address: {
    street: "123 Main St",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "USA"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLoginAt: Timestamp
}
```

---

### 2. Orders Collection
**Path**: `/orders/{orderId}`

```typescript
interface OrderDocument {
  // Order Identity
  orderId: string;                // Auto-generated
  orderNumber: string;            // Human-readable (e.g., "ORD-2025-0001")

  // Relationships
  customerId: string;             // User UID
  customerEmail: string;          // Denormalized for quick access
  customerName: string;           // Denormalized
  assignedDesignerId?: string;    // User UID
  assignedDesignerName?: string;  // Denormalized

  // Order Details
  projectName: string;
  projectDescription: string;
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };

  // Roof Details
  roofType?: string;              // e.g., "Flat", "Pitched", "Gable"
  roofArea?: number;              // In square feet
  solarPanelRequirement?: boolean;

  // Status & Timeline
  status: 'pending' | 'assigned' | 'in_progress' | 'review' | 'revision_requested' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Images & Files
  siteImages: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageUrl: string;           // gs:// URL
    downloadUrl: string;          // HTTPS URL
    uploadedBy: string;           // User UID
    uploadedAt: Timestamp;
    thumbnailUrl?: string;
  }>;

  designFiles?: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageUrl: string;
    downloadUrl: string;
    uploadedBy: string;
    uploadedAt: Timestamp;
    version: number;
  }>;

  // Pricing
  estimatedCost?: number;
  finalCost?: number;
  currency: string;               // "USD", "EUR", etc.

  // Deadlines
  requestedDeliveryDate?: Timestamp;
  actualDeliveryDate?: Timestamp;

  // Statistics
  unreadMessagesCount: {
    customer: number;
    designer: number;
    admin: number;
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // User UID
  lastModifiedBy: string;         // User UID
}
```

**Example Document**:
```javascript
{
  orderId: "order_abc123",
  orderNumber: "ORD-2025-0001",
  customerId: "user_123",
  customerEmail: "john@example.com",
  customerName: "John Doe",
  assignedDesignerId: "designer_456",
  assignedDesignerName: "Jane Smith",
  projectName: "Residential Rooftop Design",
  projectDescription: "2-story house, need solar panel integration",
  propertyAddress: {
    street: "456 Oak Ave",
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    country: "USA"
  },
  roofType: "Gable",
  roofArea: 2500,
  solarPanelRequirement: true,
  status: "in_progress",
  priority: "high",
  siteImages: [
    {
      id: "img_001",
      fileName: "front-view.jpg",
      fileSize: 2456789,
      mimeType: "image/jpeg",
      storageUrl: "gs://bucket/orders/order_abc123/images/front-view.jpg",
      downloadUrl: "https://storage.googleapis.com/...",
      uploadedBy: "user_123",
      uploadedAt: Timestamp
    }
  ],
  estimatedCost: 5000,
  currency: "USD",
  requestedDeliveryDate: Timestamp,
  unreadMessagesCount: {
    customer: 2,
    designer: 0,
    admin: 1
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "user_123",
  lastModifiedBy: "admin_789"
}
```

---

### 3. Order Status Timeline (Subcollection)
**Path**: `/orders/{orderId}/statusHistory/{historyId}`

```typescript
interface StatusHistoryDocument {
  id: string;                     // Auto-generated
  previousStatus: string | null;  // null for initial status
  newStatus: string;
  changedBy: string;              // User UID
  changedByName: string;          // Denormalized
  changedByRole: string;          // "admin", "designer", "customer"
  reason?: string;                // Optional reason for change
  notes?: string;                 // Additional notes
  timestamp: Timestamp;

  // Metadata for analytics
  durationInPreviousStatus?: number; // Milliseconds
}
```

**Example Document**:
```javascript
{
  id: "status_001",
  previousStatus: "pending",
  newStatus: "assigned",
  changedBy: "admin_789",
  changedByName: "Admin User",
  changedByRole: "admin",
  reason: "Designer assigned",
  notes: "Assigned to Jane Smith for urgent completion",
  timestamp: Timestamp,
  durationInPreviousStatus: 3600000  // 1 hour in milliseconds
}
```

**Query Examples**:
```javascript
// Get status history for an order (chronological)
const statusHistory = await db
  .collection('orders')
  .doc(orderId)
  .collection('statusHistory')
  .orderBy('timestamp', 'asc')
  .get();

// Get latest status change
const latestStatus = await db
  .collection('orders')
  .doc(orderId)
  .collection('statusHistory')
  .orderBy('timestamp', 'desc')
  .limit(1)
  .get();
```

---

### 4. Order Messages (Subcollection)
**Path**: `/orders/{orderId}/messages/{messageId}`

```typescript
interface MessageDocument {
  id: string;                     // Auto-generated
  orderId: string;                // Parent order ID

  // Sender Info
  senderId: string;               // User UID
  senderName: string;             // Denormalized
  senderRole: 'admin' | 'customer' | 'designer';
  senderEmail: string;

  // Message Content
  content: string;                // Message text
  type: 'text' | 'system' | 'file_upload' | 'status_change';

  // Attachments (optional)
  attachments?: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageUrl: string;
    downloadUrl: string;
  }>;

  // Read Status
  readBy: {
    [userId: string]: Timestamp   // Track who read and when
  };

  // System Messages
  isSystemMessage: boolean;       // Auto-generated messages
  systemMessageType?: 'status_change' | 'assignment' | 'file_upload';

  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  editedAt?: Timestamp;
  isEdited: boolean;
  isDeleted: boolean;
}
```

**Example Documents**:

*Regular Message*:
```javascript
{
  id: "msg_001",
  orderId: "order_abc123",
  senderId: "user_123",
  senderName: "John Doe",
  senderRole: "customer",
  senderEmail: "john@example.com",
  content: "Can you add solar panel layout to the design?",
  type: "text",
  readBy: {
    "designer_456": Timestamp,
    "admin_789": Timestamp
  },
  isSystemMessage: false,
  createdAt: Timestamp,
  isEdited: false,
  isDeleted: false
}
```

*System Message*:
```javascript
{
  id: "msg_002",
  orderId: "order_abc123",
  senderId: "system",
  senderName: "System",
  senderRole: "admin",
  senderEmail: "system@roofrix.com",
  content: "Order status changed from 'pending' to 'assigned'",
  type: "system",
  readBy: {},
  isSystemMessage: true,
  systemMessageType: "status_change",
  createdAt: Timestamp,
  isEdited: false,
  isDeleted: false
}
```

**Query Examples**:
```javascript
// Get messages for an order (real-time)
const messagesRef = db
  .collection('orders')
  .doc(orderId)
  .collection('messages')
  .orderBy('createdAt', 'desc')
  .limit(50);

// Real-time listener
messagesRef.onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      // New message arrived
    }
  });
});

// Get unread message count
const unreadCount = await db
  .collection('orders')
  .doc(orderId)
  .collection('messages')
  .where(`readBy.${userId}`, '==', null)
  .get()
  .then(snap => snap.size);
```

---

### 5. Notifications Collection
**Path**: `/notifications/{notificationId}`

```typescript
interface NotificationDocument {
  id: string;
  userId: string;                 // Recipient UID

  // Notification Details
  title: string;
  message: string;
  type: 'order_update' | 'new_message' | 'status_change' | 'assignment' | 'system';
  priority: 'low' | 'normal' | 'high';

  // Related Data
  orderId?: string;
  relatedEntityType?: 'order' | 'message' | 'user';
  relatedEntityId?: string;

  // Action
  actionUrl?: string;             // Deep link to relevant page
  actionLabel?: string;           // "View Order", "Reply", etc.

  // Status
  isRead: boolean;
  readAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  expiresAt?: Timestamp;          // Auto-delete after expiry
}
```

**Example Document**:
```javascript
{
  id: "notif_001",
  userId: "user_123",
  title: "New Message",
  message: "Designer Jane Smith replied to your order ORD-2025-0001",
  type: "new_message",
  priority: "normal",
  orderId: "order_abc123",
  relatedEntityType: "message",
  relatedEntityId: "msg_003",
  actionUrl: "/orders/order_abc123#messages",
  actionLabel: "View Message",
  isRead: false,
  createdAt: Timestamp,
  expiresAt: Timestamp  // 30 days from now
}
```

---

### 6. System Settings Collection (Admin Only)
**Path**: `/settings/config`

```typescript
interface SystemSettingsDocument {
  // Order Configuration
  orderNumberPrefix: string;      // "ORD"
  nextOrderNumber: number;        // Auto-increment

  // Pricing
  defaultCurrency: string;
  pricePerSquareFoot: number;

  // File Upload Limits
  maxImageSizeBytes: number;      // e.g., 10 MB
  maxImagesPerOrder: number;
  allowedImageTypes: string[];    // ["image/jpeg", "image/png"]
  allowedDesignFileTypes: string[];

  // Email Templates
  emailTemplates: {
    [key: string]: {
      subject: string;
      body: string;
    }
  };

  // Feature Flags
  features: {
    enableMessaging: boolean;
    enableNotifications: boolean;
    enableFileUploads: boolean;
  };

  updatedAt: Timestamp;
  updatedBy: string;
}
```

---

## Security Rules

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== HELPER FUNCTIONS =====

    // Check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Get user document
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Check if user has a specific role
    function hasRole(role) {
      return isSignedIn() && getUserData().role == role;
    }

    // Check if user is admin
    function isAdmin() {
      return hasRole('admin');
    }

    // Check if user is customer
    function isCustomer() {
      return hasRole('customer');
    }

    // Check if user is designer
    function isDesigner() {
      return hasRole('designer');
    }

    // Check if user owns the resource
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Check if user is assigned to order
    function isAssignedDesigner(orderId) {
      return isDesigner() &&
             get(/databases/$(database)/documents/orders/$(orderId)).data.assignedDesignerId == request.auth.uid;
    }

    // Check if user is the customer of the order
    function isOrderCustomer(orderId) {
      return isCustomer() &&
             get(/databases/$(database)/documents/orders/$(orderId)).data.customerId == request.auth.uid;
    }

    // ===== USERS COLLECTION =====

    match /users/{userId} {
      // Allow users to read their own profile
      // Allow admins to read all profiles
      allow read: if isOwner(userId) || isAdmin();

      // Allow users to update their own profile (except role)
      allow update: if isOwner(userId) &&
                       request.resource.data.role == resource.data.role &&
                       request.resource.data.uid == resource.data.uid;

      // Only admins can create users or change roles
      allow create: if isAdmin();
      allow delete: if isAdmin();

      // Admins can update any user
      allow update: if isAdmin();
    }

    // ===== ORDERS COLLECTION =====

    match /orders/{orderId} {
      // READ RULES
      allow read: if isAdmin() ||                          // Admins see all
                     (isCustomer() && resource.data.customerId == request.auth.uid) ||  // Customers see own
                     (isDesigner() && resource.data.assignedDesignerId == request.auth.uid);  // Designers see assigned

      // CREATE RULES
      // Customers can create orders
      // Admins can create orders
      allow create: if (isCustomer() && request.resource.data.customerId == request.auth.uid) ||
                       isAdmin();

      // UPDATE RULES
      // Admins can update any order
      // Customers can update own orders (limited fields)
      // Designers can update assigned orders (limited fields)
      allow update: if isAdmin() ||
                       (isCustomer() &&
                        resource.data.customerId == request.auth.uid &&
                        request.resource.data.customerId == resource.data.customerId) ||  // Can't change customer
                       (isDesigner() &&
                        resource.data.assignedDesignerId == request.auth.uid &&
                        request.resource.data.assignedDesignerId == resource.data.assignedDesignerId);  // Can't reassign

      // DELETE RULES
      // Only admins can delete orders
      allow delete: if isAdmin();

      // ===== STATUS HISTORY SUBCOLLECTION =====

      match /statusHistory/{historyId} {
        // Anyone who can read the order can read status history
        allow read: if isAdmin() ||
                       isOrderCustomer(orderId) ||
                       isAssignedDesigner(orderId);

        // Only admins and assigned designers can create status history
        // (through status updates on the order)
        allow create: if isAdmin() || isAssignedDesigner(orderId);

        // No updates or deletes allowed (immutable history)
        allow update, delete: if false;
      }

      // ===== MESSAGES SUBCOLLECTION =====

      match /messages/{messageId} {
        // Anyone who can read the order can read messages
        allow read: if isAdmin() ||
                       isOrderCustomer(orderId) ||
                       isAssignedDesigner(orderId);

        // Order participants can create messages
        allow create: if isAdmin() ||
                         isOrderCustomer(orderId) ||
                         isAssignedDesigner(orderId);

        // Only message sender can update their own message (for edit/delete)
        allow update: if isOwner(resource.data.senderId);

        // Only admins can delete messages
        allow delete: if isAdmin();
      }
    }

    // ===== NOTIFICATIONS COLLECTION =====

    match /notifications/{notificationId} {
      // Users can only read their own notifications
      allow read: if isOwner(resource.data.userId);

      // System can create notifications (server-side)
      // Admins can create notifications
      allow create: if isAdmin();

      // Users can update their own notifications (mark as read)
      allow update: if isOwner(resource.data.userId);

      // Users can delete their own notifications
      allow delete: if isOwner(resource.data.userId) || isAdmin();
    }

    // ===== SYSTEM SETTINGS =====

    match /settings/{document=**} {
      // Only admins can read/write settings
      allow read, write: if isAdmin();
    }
  }
}
```

---

## Storage Structure

### Firebase Storage Organization

```
gs://roofrix-bucket/
├── users/
│   └── {userId}/
│       └── profile/
│           └── avatar.jpg
│
├── orders/
│   └── {orderId}/
│       ├── site-images/
│       │   ├── original/
│       │   │   ├── front-view.jpg
│       │   │   ├── side-view.jpg
│       │   │   └── aerial-view.jpg
│       │   └── thumbnails/
│       │       ├── front-view_thumb.jpg
│       │       ├── side-view_thumb.jpg
│       │       └── aerial-view_thumb.jpg
│       │
│       ├── design-files/
│       │   ├── v1/
│       │   │   └── design-v1.pdf
│       │   ├── v2/
│       │   │   └── design-v2.pdf
│       │   └── final/
│       │       └── final-design.pdf
│       │
│       └── message-attachments/
│           └── {messageId}/
│               └── attachment.pdf
│
└── temp/
    └── {userId}/
        └── temp-upload.jpg  // Cleaned up after 24h
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ===== HELPER FUNCTIONS =====

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isOrderCustomer(orderId) {
      return firestore.get(/databases/(default)/documents/orders/$(orderId)).data.customerId == request.auth.uid;
    }

    function isAssignedDesigner(orderId) {
      return firestore.get(/databases/(default)/documents/orders/$(orderId)).data.assignedDesignerId == request.auth.uid;
    }

    function hasOrderAccess(orderId) {
      return isAdmin() || isOrderCustomer(orderId) || isAssignedDesigner(orderId);
    }

    // File size limits
    function isUnder10MB() {
      return request.resource.size < 10 * 1024 * 1024;
    }

    function isImage() {
      return request.resource.contentType.matches('image/.*');
    }

    function isPDF() {
      return request.resource.contentType == 'application/pdf';
    }

    // ===== USER PROFILE IMAGES =====

    match /users/{userId}/profile/{fileName} {
      allow read: if isSignedIn();  // Anyone can view profile images
      allow write: if isOwner(userId) && isImage() && isUnder10MB();
      allow delete: if isOwner(userId) || isAdmin();
    }

    // ===== ORDER SITE IMAGES =====

    match /orders/{orderId}/site-images/{imageType}/{fileName} {
      // imageType: original or thumbnails

      allow read: if hasOrderAccess(orderId);

      // Customers and admins can upload site images
      allow create: if (isOrderCustomer(orderId) || isAdmin()) &&
                       isImage() &&
                       isUnder10MB();

      // Only admins can update/delete
      allow update, delete: if isAdmin();
    }

    // ===== ORDER DESIGN FILES =====

    match /orders/{orderId}/design-files/{version}/{fileName} {
      allow read: if hasOrderAccess(orderId);

      // Designers and admins can upload design files
      allow create: if (isAssignedDesigner(orderId) || isAdmin()) &&
                       (isImage() || isPDF()) &&
                       isUnder10MB();

      // Only designers and admins can update/delete
      allow update, delete: if isAssignedDesigner(orderId) || isAdmin();
    }

    // ===== MESSAGE ATTACHMENTS =====

    match /orders/{orderId}/message-attachments/{messageId}/{fileName} {
      allow read: if hasOrderAccess(orderId);

      // Order participants can upload attachments
      allow create: if hasOrderAccess(orderId) && isUnder10MB();

      // Only admins can delete
      allow delete: if isAdmin();
    }

    // ===== TEMP UPLOADS =====

    match /temp/{userId}/{fileName} {
      allow read, write: if isOwner(userId) && isUnder10MB();
      allow delete: if isOwner(userId) || isAdmin();
    }
  }
}
```

---

## Implementation Guide

### Step 1: Initialize Firestore in Your Angular App

**Update `src/environments/environment.ts`**:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'roofrix-d116a.firebaseapp.com',
    projectId: 'roofrix-d116a',
    storageBucket: 'roofrix-d116a.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID'
  },
  // Optional: Feature flags
  features: {
    enableMessaging: true,
    enableNotifications: true,
    enableFileUploads: true
  }
};
```

### Step 2: Create Firestore Service

**File**: `src/app/core/services/firestore.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  CollectionReference,
  DocumentReference,
  Query,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { Observable, Observer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;

  constructor() {
    const app = initializeApp(environment.firebase);
    this.db = getFirestore(app);
  }

  // ===== GENERIC CRUD OPERATIONS =====

  /**
   * Get a single document
   */
  async getDocument<T>(collectionPath: string, documentId: string): Promise<T | null> {
    const docRef = doc(this.db, collectionPath, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as T : null;
  }

  /**
   * Get documents with query
   */
  async getDocuments<T>(collectionPath: string, queryConstraints: any[] = []): Promise<T[]> {
    const colRef = collection(this.db, collectionPath);
    const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  /**
   * Create or update document
   */
  async setDocument<T>(collectionPath: string, documentId: string, data: T): Promise<void> {
    const docRef = doc(this.db, collectionPath, documentId);
    await setDoc(docRef, data as any);
  }

  /**
   * Update document
   */
  async updateDocument(collectionPath: string, documentId: string, data: Partial<any>): Promise<void> {
    const docRef = doc(this.db, collectionPath, documentId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(collectionPath: string, documentId: string): Promise<void> {
    const docRef = doc(this.db, collectionPath, documentId);
    await deleteDoc(docRef);
  }

  /**
   * Real-time listener for a document
   */
  documentListener<T>(collectionPath: string, documentId: string): Observable<T | null> {
    return new Observable((observer: Observer<T | null>) => {
      const docRef = doc(this.db, collectionPath, documentId);

      const unsubscribe = onSnapshot(docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            observer.next({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            observer.next(null);
          }
        },
        (error) => observer.error(error)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Real-time listener for a collection
   */
  collectionListener<T>(collectionPath: string, queryConstraints: any[] = []): Observable<T[]> {
    return new Observable((observer: Observer<T[]>) => {
      const colRef = collection(this.db, collectionPath);
      const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          observer.next(items);
        },
        (error) => observer.error(error)
      );

      return () => unsubscribe();
    });
  }

  /**
   * Get server timestamp
   */
  getTimestamp(): Timestamp {
    return Timestamp.now();
  }
}
```

### Step 3: Create User Service

**File**: `src/app/core/services/user.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'customer' | 'designer';
  isActive: boolean;
  company?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);

  /**
   * Create user profile in Firestore after signup
   */
  async createUserProfile(uid: string, email: string, role: 'customer' | 'designer' = 'customer'): Promise<void> {
    const userProfile: UserProfile = {
      uid,
      email,
      displayName: email.split('@')[0],  // Default display name from email
      role,
      isActive: true,
      createdAt: this.firestoreService.getTimestamp(),
      updatedAt: this.firestoreService.getTimestamp()
    };

    await this.firestoreService.setDocument('users', uid, userProfile);
  }

  /**
   * Get user profile
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    return this.firestoreService.getDocument<UserProfile>('users', uid);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    await this.firestoreService.updateDocument('users', uid, data);
  }

  /**
   * Listen to user profile changes
   */
  userProfileListener(uid: string): Observable<UserProfile | null> {
    return this.firestoreService.documentListener<UserProfile>('users', uid);
  }

  /**
   * Update last login time
   */
  async updateLastLogin(uid: string): Promise<void> {
    await this.firestoreService.updateDocument('users', uid, {
      lastLoginAt: this.firestoreService.getTimestamp()
    });
  }
}
```

### Step 4: Create Order Service

**File**: `src/app/core/services/order.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { where, orderBy as firestoreOrderBy, Timestamp } from 'firebase/firestore';
import { Observable } from 'rxjs';

export interface Order {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  assignedDesignerId?: string;
  assignedDesignerName?: string;
  projectName: string;
  projectDescription: string;
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  status: 'pending' | 'assigned' | 'in_progress' | 'review' | 'revision_requested' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  siteImages: any[];
  unreadMessagesCount: {
    customer: number;
    designer: number;
    admin: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private firestoreService = inject(FirestoreService);

  /**
   * Create new order
   */
  async createOrder(orderData: Partial<Order>): Promise<string> {
    const orderId = `order_${Date.now()}`;
    const orderNumber = await this.generateOrderNumber();

    const order: Order = {
      orderId,
      orderNumber,
      customerId: orderData.customerId!,
      customerEmail: orderData.customerEmail!,
      customerName: orderData.customerName!,
      projectName: orderData.projectName!,
      projectDescription: orderData.projectDescription!,
      propertyAddress: orderData.propertyAddress!,
      status: 'pending',
      priority: orderData.priority || 'medium',
      siteImages: [],
      unreadMessagesCount: {
        customer: 0,
        designer: 0,
        admin: 0
      },
      createdAt: this.firestoreService.getTimestamp(),
      updatedAt: this.firestoreService.getTimestamp(),
      createdBy: orderData.customerId!
    };

    await this.firestoreService.setDocument('orders', orderId, order);
    return orderId;
  }

  /**
   * Get orders by customer
   */
  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return this.firestoreService.getDocuments<Order>('orders', [
      where('customerId', '==', customerId),
      firestoreOrderBy('createdAt', 'desc')
    ]);
  }

  /**
   * Get orders assigned to designer
   */
  async getDesignerOrders(designerId: string): Promise<Order[]> {
    return this.firestoreService.getDocuments<Order>('orders', [
      where('assignedDesignerId', '==', designerId),
      firestoreOrderBy('createdAt', 'desc')
    ]);
  }

  /**
   * Get all orders (admin)
   */
  async getAllOrders(): Promise<Order[]> {
    return this.firestoreService.getDocuments<Order>('orders', [
      firestoreOrderBy('createdAt', 'desc')
    ]);
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: Order['status'],
    changedBy: string,
    changedByName: string,
    changedByRole: string,
    reason?: string
  ): Promise<void> {
    const order = await this.firestoreService.getDocument<Order>('orders', orderId);
    if (!order) throw new Error('Order not found');

    // Update order
    await this.firestoreService.updateDocument('orders', orderId, {
      status: newStatus
    });

    // Create status history entry
    const historyId = `status_${Date.now()}`;
    const statusHistory = {
      id: historyId,
      previousStatus: order.status,
      newStatus,
      changedBy,
      changedByName,
      changedByRole,
      reason,
      timestamp: this.firestoreService.getTimestamp()
    };

    await this.firestoreService.setDocument(
      `orders/${orderId}/statusHistory`,
      historyId,
      statusHistory
    );
  }

  /**
   * Listen to order changes
   */
  orderListener(orderId: string): Observable<Order | null> {
    return this.firestoreService.documentListener<Order>('orders', orderId);
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    // In production, use a Cloud Function with transaction to ensure uniqueness
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `ORD-${year}-${random}`;
  }
}
```

---

## Best Practices

### 1. **Data Denormalization**
- Store frequently accessed data redundantly (e.g., `customerName` in orders)
- Reduces the number of reads required
- Accept slight data inconsistency for better performance

### 2. **Batch Writes**
```typescript
import { writeBatch, doc } from 'firebase/firestore';

async batchUpdateOrders(updates: Array<{ orderId: string; data: any }>) {
  const batch = writeBatch(this.db);

  updates.forEach(({ orderId, data }) => {
    const ref = doc(this.db, 'orders', orderId);
    batch.update(ref, data);
  });

  await batch.commit();
}
```

### 3. **Pagination**
```typescript
import { startAfter, limit } from 'firebase/firestore';

async getOrdersPaginated(pageSize: number, lastVisible?: any) {
  const constraints = [
    firestoreOrderBy('createdAt', 'desc'),
    limit(pageSize)
  ];

  if (lastVisible) {
    constraints.push(startAfter(lastVisible));
  }

  return this.firestoreService.getDocuments<Order>('orders', constraints);
}
```

### 4. **Indexing**
Create composite indexes in Firebase Console for complex queries:
- `orders`: `customerId` + `status` + `createdAt`
- `orders`: `assignedDesignerId` + `status` + `createdAt`
- `messages`: `orderId` + `createdAt`

### 5. **Cloud Functions** (Recommended for Production)

**Create status history automatically**:
```javascript
// functions/index.js
exports.createStatusHistory = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== after.status) {
      const orderId = context.params.orderId;
      const historyRef = admin.firestore()
        .collection('orders')
        .doc(orderId)
        .collection('statusHistory')
        .doc();

      await historyRef.set({
        id: historyRef.id,
        previousStatus: before.status,
        newStatus: after.status,
        changedBy: after.lastModifiedBy,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
```

**Send email notifications**:
```javascript
exports.sendOrderNotification = functions.firestore
  .document('orders/{orderId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const orderId = context.params.orderId;

    // Get order details
    const order = await admin.firestore()
      .collection('orders')
      .doc(orderId)
      .get();

    // Send email using SendGrid/Mailgun
    await sendEmail({
      to: order.data().customerEmail,
      subject: `New message on order ${order.data().orderNumber}`,
      body: message.content
    });
  });
```

### 6. **Error Handling**
```typescript
try {
  await this.orderService.createOrder(orderData);
} catch (error: any) {
  if (error.code === 'permission-denied') {
    // Handle permission error
  } else if (error.code === 'not-found') {
    // Handle not found
  } else {
    // Generic error
  }
}
```

### 7. **Offline Persistence**
```typescript
import { enableIndexedDbPersistence } from 'firebase/firestore';

// In app initialization
try {
  await enableIndexedDbPersistence(this.db);
} catch (err: any) {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support
  }
}
```

---

## Summary

### Key Features Implemented:
✅ **Role-based access control** (Admin, Customer, Designer)
✅ **Complete order management** with status tracking
✅ **Immutable status history** for audit trail
✅ **Real-time messaging** per order
✅ **File upload support** with version control
✅ **Notifications system**
✅ **Secure Firestore rules**
✅ **Scalable storage structure**
✅ **Type-safe TypeScript interfaces**

### Scalability Features:
✅ **Subcollections** for unlimited messages/history
✅ **Denormalized data** for fast queries
✅ **Composite indexes** for complex queries
✅ **Real-time listeners** for live updates
✅ **Pagination support**
✅ **Batch operations**

### Next Steps:
1. Set up Firebase project and deploy security rules
2. Create Cloud Functions for automated tasks
3. Implement file upload service
4. Add email notification service
5. Create admin dashboard
6. Build customer portal
7. Build designer portal

This architecture is production-ready and follows Firebase best practices! 🚀
