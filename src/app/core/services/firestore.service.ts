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
  DocumentSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { initializeApp, getApp } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;

  constructor() {
    // Use the default Firebase app (shared with auth)
    let app;
    try {
      app = initializeApp(environment.firebase);
    } catch {
      app = getApp();
    }
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
   * Get array field modifiers for efficient array updates
   * Use arrayUnion to add items without reading the entire document first
   */
  getArrayHelpers() {
    return {
      arrayUnion,
      arrayRemove
    };
  }

  /**
   * Atomically increment a counter and return the new value.
   * Creates the document/field if it doesn't exist.
   */
  async incrementCounter(collectionPath: string, documentId: string, field: string): Promise<number> {
    const docRef = doc(this.db, collectionPath, documentId);
    const newValue = await runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const current = snapshot.exists() ? (snapshot.data()?.[field] || 0) : 0;
      const next = current + 1;
      transaction.set(docRef, { [field]: next }, { merge: true });
      return next;
    });
    return newValue;
  }

  /**
   * Append items to an array field efficiently (without reading full document)
   */
  async appendToArrayField(
    collectionPath: string,
    documentId: string,
    fieldName: string,
    items: any[]
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await updateDoc(docRef, {
        [fieldName]: arrayUnion(...items),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove items from an array field efficiently
   */
  async removeFromArrayField(
    collectionPath: string,
    documentId: string,
    fieldName: string,
    items: any[]
  ): Promise<void> {
    try {
      const docRef = doc(this.db, collectionPath, documentId);
      await updateDoc(docRef, {
        [fieldName]: arrayRemove(...items),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      throw error;
    }
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
      throw error;
    }
  }
}
