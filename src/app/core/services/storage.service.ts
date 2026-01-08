import { Injectable } from '@angular/core';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
  StorageReference,
  UploadTaskSnapshot,
  UploadTask
} from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface UploadProgress {
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
  downloadURL?: string;
  error?: string;
}

export type StorageFolder = 'site-images' | 'design-files' | 'message-attachments' | 'user-avatars';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage: FirebaseStorage;

  constructor() {
    // Initialize Firebase app for storage if not already initialized
    const app = initializeApp(environment.firebase, 'storage-app');
    this.storage = getStorage(app);
  }

  /**
   * Generate unique file name to prevent collisions
   */
  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');

    return `${sanitizedName}_${timestamp}_${randomString}.${extension}`;
  }

  /**
   * Build storage path based on folder and user/order context
   */
  private buildStoragePath(
    folder: StorageFolder,
    fileName: string,
    userId?: string,
    orderId?: string
  ): string {
    let path = '';

    switch (folder) {
      case 'site-images':
        if (!orderId) throw new Error('orderId is required for site-images');
        path = `orders/${orderId}/site-images/${fileName}`;
        break;

      case 'design-files':
        if (!orderId) throw new Error('orderId is required for design-files');
        path = `orders/${orderId}/design-files/${fileName}`;
        break;

      case 'message-attachments':
        if (!orderId) throw new Error('orderId is required for message-attachments');
        path = `orders/${orderId}/messages/${fileName}`;
        break;

      case 'user-avatars':
        if (!userId) throw new Error('userId is required for user-avatars');
        path = `users/${userId}/avatar/${fileName}`;
        break;

      default:
        throw new Error(`Unknown storage folder: ${folder}`);
    }

    return path;
  }

  /**
   * Upload file with progress tracking
   */
  uploadFileWithProgress(
    file: File,
    folder: StorageFolder,
    userId?: string,
    orderId?: string
  ): Observable<UploadProgress> {
    return new Observable(observer => {
      try {
        // Validate file
        if (!file) {
          observer.error('No file provided');
          return;
        }

        // Generate unique file name
        const uniqueFileName = this.generateUniqueFileName(file.name);

        // Build storage path
        const storagePath = this.buildStoragePath(folder, uniqueFileName, userId, orderId);

        // Create storage reference
        const storageRef = ref(this.storage, storagePath);

        // Create upload task
        const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);

        // Monitor upload progress
        uploadTask.on(
          'state_changed',
          (snapshot: UploadTaskSnapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

            observer.next({
              progress: Math.round(progress),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              state: snapshot.state as 'running' | 'paused' | 'success' | 'canceled' | 'error'
            });
          },
          (error) => {
            console.error('Upload error:', error);
            observer.next({
              progress: 0,
              bytesTransferred: 0,
              totalBytes: 0,
              state: 'error',
              error: error.message
            });
            observer.error(error);
          },
          async () => {
            // Upload completed successfully
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              observer.next({
                progress: 100,
                bytesTransferred: uploadTask.snapshot.totalBytes,
                totalBytes: uploadTask.snapshot.totalBytes,
                state: 'success',
                downloadURL
              });

              observer.complete();
            } catch (error) {
              console.error('Error getting download URL:', error);
              observer.error(error);
            }
          }
        );
      } catch (error) {
        console.error('Upload setup error:', error);
        observer.error(error);
      }
    });
  }

  /**
   * Simple file upload without progress tracking
   */
  async uploadFile(
    file: File,
    folder: StorageFolder,
    userId?: string,
    orderId?: string
  ): Promise<string> {
    try {
      // Generate unique file name
      const uniqueFileName = this.generateUniqueFileName(file.name);

      // Build storage path
      const storagePath = this.buildStoragePath(folder, uniqueFileName, userId, orderId);

      // Create storage reference
      const storageRef = ref(this.storage, storagePath);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: File[],
    folder: StorageFolder,
    userId?: string,
    orderId?: string
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map(file =>
        this.uploadFile(file, folder, userId, orderId)
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    }
  }

  /**
   * Delete file by URL
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract path from URL
      const storagePath = this.extractPathFromUrl(fileUrl);

      if (!storagePath) {
        throw new Error('Invalid file URL');
      }

      // Create storage reference
      const storageRef = ref(this.storage, storagePath);

      // Delete file
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
    try {
      const deletePromises = fileUrls.map(url => this.deleteFile(url));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting multiple files:', error);
      throw error;
    }
  }

  /**
   * List all files in a specific order folder
   */
  async listOrderFiles(orderId: string, fileType: 'site-images' | 'design-files'): Promise<string[]> {
    try {
      const folderPath = fileType === 'site-images'
        ? `orders/${orderId}/site-images`
        : `orders/${orderId}/design-files`;

      const folderRef = ref(this.storage, folderPath);
      const result = await listAll(folderRef);

      // Get download URLs for all files
      const urlPromises = result.items.map(itemRef => getDownloadURL(itemRef));
      return await Promise.all(urlPromises);
    } catch (error) {
      console.error('Error listing order files:', error);
      throw error;
    }
  }

  /**
   * Extract storage path from download URL
   */
  private extractPathFromUrl(url: string): string | null {
    try {
      // Firebase Storage URLs have format:
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}

      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);

      if (pathMatch && pathMatch[1]) {
        // Decode the path (it's URL encoded)
        return decodeURIComponent(pathMatch[1]);
      }

      return null;
    } catch (error) {
      console.error('Error extracting path from URL:', error);
      return null;
    }
  }

  /**
   * Get file metadata (size, content type, etc.)
   */
  async getFileMetadata(fileUrl: string): Promise<any> {
    try {
      const storagePath = this.extractPathFromUrl(fileUrl);

      if (!storagePath) {
        throw new Error('Invalid file URL');
      }

      const storageRef = ref(this.storage, storagePath);
      const metadata = await getMetadata(storageRef);

      return metadata;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Validate file type
   */
  validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        // Check MIME type prefix (e.g., 'image/*')
        const prefix = type.split('/')[0];
        return file.type.startsWith(prefix + '/');
      }
      return file.type === type;
    });
  }

  /**
   * Validate file size
   */
  validateFileSize(file: File, maxSizeInMB: number): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: File,
    allowedTypes: string[],
    maxSizeInMB: number
  ): { valid: boolean; error?: string } {
    if (!this.validateFileType(file, allowedTypes)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    if (!this.validateFileSize(file, maxSizeInMB)) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeInMB}MB limit`
      };
    }

    return { valid: true };
  }

  /**
   * Common validation presets
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    return this.validateFile(file, ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'], 10);
  }

  validateDocumentFile(file: File): { valid: boolean; error?: string } {
    return this.validateFile(
      file,
      ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      20
    );
  }

  validateDesignFile(file: File): { valid: boolean; error?: string } {
    return this.validateFile(
      file,
      [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/dwg',
        'application/dxf',
        'application/zip'
      ],
      50
    );
  }
}
