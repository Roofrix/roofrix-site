import { Injectable } from '@angular/core';
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
  startAfter,
  Timestamp,
  QueryConstraint,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { initializeApp } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;

  constructor() {
    // Initialize Firebase app if not already initialized
    const app = initializeApp(environment.firebase, 'firestore-app');
    this.db = getFirestore(app);
  }

  // ===== GENERIC CRUD OPERATIONS =====

  /**
   * Get a single document by ID
   */
  async getDocument<T>(collectionPath: string, documentId: string): Promise<T | null> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }

  /**
   * Get multiple documents with optional query constraints
   */
  async getDocuments<T>(
    collectionPath: string,
    queryConstraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      const colRef = collection(this.db, collectionPath);
      const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  }

  /**
   * Create or update a document
   */
  async setDocument<T>(
    collectionPath: string,
    documentId: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await setDoc(docRef, data as DocumentData);
    } catch (error) {
      console.error('Error setting document:', error);
      throw error;
    }
  }

  /**
   * Update an existing document
   */
  async updateDocument(
    collectionPath: string,
    documentId: string,
    data: Partial<any>
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionPath: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  // ===== REAL-TIME LISTENERS =====

  /**
   * Listen to a single document in real-time
   */
  documentListener<T>(collectionPath: string, documentId: string): Observable<T | null> {
    return new Observable(observer => {
      const docRef = doc(this.db, collectionPath, documentId);

      const unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot) => {
          if (snapshot.exists()) {
            observer.next({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            observer.next(null);
          }
        },
        (error) => {
          console.error('Document listener error:', error);
          observer.error(error);
        }
      );

      // Return cleanup function
      return () => unsubscribe();
    });
  }

  /**
   * Listen to a collection in real-time
   */
  collectionListener<T>(
    collectionPath: string,
    queryConstraints: QueryConstraint[] = []
  ): Observable<T[]> {
    return new Observable(observer => {
      const colRef = collection(this.db, collectionPath);
      const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;

      const unsubscribe = onSnapshot(
        q,
        (snapshot: QuerySnapshot) => {
          const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as T));
          observer.next(items);
        },
        (error) => {
          console.error('Collection listener error:', error);
          observer.error(error);
        }
      );

      // Return cleanup function
      return () => unsubscribe();
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Get current server timestamp
   */
  getTimestamp(): Timestamp {
    return Timestamp.now();
  }

  /**
   * Convert Timestamp to Date
   */
  timestampToDate(timestamp: Timestamp): Date {
    return timestamp.toDate();
  }

  /**
   * Convert Date to Timestamp
   */
  dateToTimestamp(date: Date): Timestamp {
    return Timestamp.fromDate(date);
  }

  /**
   * Get Firestore query helpers
   */
  getQueryHelpers() {
    return {
      where,
      orderBy,
      limit,
      startAfter
    };
  }

  /**
   * Get documents with pagination support
   */
  async getDocumentsWithPagination<T>(
    collectionPath: string,
    queryConstraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      const colRef = collection(this.db, collectionPath);
      const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
    } catch (error) {
      console.error('Error getting paginated documents:', error);
      throw error;
    }
  }
}
