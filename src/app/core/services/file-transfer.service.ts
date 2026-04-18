import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FileTransferService {
  // Single order files
  private files: File[] = [];

  // Cart item files (keyed by cart item ID)
  private cartFiles: Map<string, File[]> = new Map();

  // Single order methods
  setFiles(files: File[]): void {
    this.files = files;
  }

  getFiles(): File[] {
    return this.files;
  }

  // Cart methods
  addCartItemFiles(cartItemId: string, files: File[]): void {
    if (files.length > 0) {
      this.cartFiles.set(cartItemId, files);
    }
  }

  getCartItemFiles(cartItemId: string): File[] {
    return this.cartFiles.get(cartItemId) || [];
  }

  getAllCartFiles(): File[] {
    const allFiles: File[] = [];
    this.cartFiles.forEach(files => allFiles.push(...files));
    return allFiles;
  }

  removeCartItemFiles(cartItemId: string): void {
    this.cartFiles.delete(cartItemId);
  }

  clear(): void {
    this.files = [];
    this.cartFiles.clear();
  }

  hasFiles(): boolean {
    return this.files.length > 0 || this.cartFiles.size > 0;
  }
}
