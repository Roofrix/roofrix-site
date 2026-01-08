import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { Observable } from 'rxjs';

export type OrderStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string; // e.g., "ORD-2024-0001"
  customerId: string;
  customerEmail: string;
  customerName: string;
  assignedDesignerId?: string;
  assignedDesignerEmail?: string;

  // Order details
  projectName: string;
  projectAddress: string;
  projectDescription?: string;
  roofType?: string;
  estimatedArea?: number;

  // Status tracking
  status: OrderStatus;
  currentStatusUpdatedAt: any;
  currentStatusUpdatedBy: string;

  // File references
  siteImages: string[]; // Firebase Storage URLs
  designFiles: string[]; // Firebase Storage URLs

  // Timestamps
  createdAt: any;
  updatedAt: any;
  completedAt?: any;

  // Additional metadata
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedCompletionDate?: any;
}

export interface StatusHistoryEntry {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedBy: string;
  changedByEmail: string;
  changedAt: any;
  notes?: string;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderEmail: string;
  senderRole: 'admin' | 'customer' | 'designer';
  message: string;
  attachments?: string[]; // Firebase Storage URLs
  createdAt: any;
  isRead: boolean;
  readBy: string[]; // Array of user IDs who have read the message
}

export interface CreateOrderData {
  customerId: string;
  customerEmail: string;
  customerName: string;
  projectName: string;
  projectAddress: string;
  projectDescription?: string;
  roofType?: string;
  estimatedArea?: number;
  priority?: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private firestoreService = inject(FirestoreService);

  private readonly ORDERS_COLLECTION = 'orders';
  private readonly STATUS_HISTORY_COLLECTION = 'statusHistory';
  private readonly MESSAGES_COLLECTION = 'messages';

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `ORD-${year}-${timestamp}`;
  }

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData, createdBy: string): Promise<string> {
    try {
      const timestamp = this.firestoreService.getTimestamp();
      const orderNumber = this.generateOrderNumber();

      // Generate a unique ID for the order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const order: Omit<Order, 'id'> = {
        orderNumber,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        projectName: data.projectName,
        projectAddress: data.projectAddress,
        projectDescription: data.projectDescription || '',
        roofType: data.roofType || '',
        estimatedArea: data.estimatedArea || 0,
        status: 'pending',
        currentStatusUpdatedAt: timestamp,
        currentStatusUpdatedBy: createdBy,
        siteImages: [],
        designFiles: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        priority: data.priority || 'medium'
      };

      await this.firestoreService.setDocument<Omit<Order, 'id'>>(
        this.ORDERS_COLLECTION,
        orderId,
        order
      );

      // Create initial status history entry
      await this.addStatusHistory(orderId, {
        status: 'pending',
        changedBy: createdBy,
        changedByEmail: data.customerEmail,
        notes: 'Order created'
      });

      return orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    try {
      return await this.firestoreService.getDocument<Order>(
        this.ORDERS_COLLECTION,
        orderId
      );
    } catch (error) {
      console.error('Error getting order:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    changedByEmail: string,
    notes?: string
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();

      // Update order status
      const updateData: Partial<Order> = {
        status: newStatus,
        currentStatusUpdatedAt: timestamp,
        currentStatusUpdatedBy: changedBy
      };

      if (newStatus === 'completed') {
        updateData.completedAt = timestamp;
      }

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        updateData
      );

      // Add to status history
      await this.addStatusHistory(orderId, {
        status: newStatus,
        changedBy,
        changedByEmail,
        notes
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Assign designer to order
   */
  async assignDesigner(
    orderId: string,
    designerId: string,
    designerEmail: string
  ): Promise<void> {
    try {
      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        {
          assignedDesignerId: designerId,
          assignedDesignerEmail: designerEmail
        }
      );
    } catch (error) {
      console.error('Error assigning designer:', error);
      throw error;
    }
  }

  /**
   * Add status history entry (private helper)
   */
  private async addStatusHistory(
    orderId: string,
    data: {
      status: OrderStatus;
      changedBy: string;
      changedByEmail: string;
      notes?: string;
    }
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();
      const historyId = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const historyEntry: Omit<StatusHistoryEntry, 'id'> = {
        orderId,
        status: data.status,
        changedBy: data.changedBy,
        changedByEmail: data.changedByEmail,
        changedAt: timestamp,
        notes: data.notes || ''
      };

      await this.firestoreService.setDocument<Omit<StatusHistoryEntry, 'id'>>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.STATUS_HISTORY_COLLECTION}`,
        historyId,
        historyEntry
      );
    } catch (error) {
      console.error('Error adding status history:', error);
      throw error;
    }
  }

  /**
   * Get status history for an order
   */
  async getStatusHistory(orderId: string): Promise<StatusHistoryEntry[]> {
    try {
      const { orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<StatusHistoryEntry>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.STATUS_HISTORY_COLLECTION}`,
        [orderBy('changedAt', 'desc')]
      );
    } catch (error) {
      console.error('Error getting status history:', error);
      throw error;
    }
  }

  /**
   * Get orders by customer
   */
  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    try {
      const { where, orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [where('customerId', '==', customerId), orderBy('createdAt', 'desc')]
      );
    } catch (error) {
      console.error('Error getting customer orders:', error);
      throw error;
    }
  }

  /**
   * Get orders by designer
   */
  async getOrdersByDesigner(designerId: string): Promise<Order[]> {
    try {
      const { where, orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [where('assignedDesignerId', '==', designerId), orderBy('createdAt', 'desc')]
      );
    } catch (error) {
      console.error('Error getting designer orders:', error);
      throw error;
    }
  }

  /**
   * Get all orders (Admin only)
   */
  async getAllOrders(): Promise<Order[]> {
    try {
      const { orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [orderBy('createdAt', 'desc')]
      );
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw error;
    }
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    try {
      const { where, orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [where('status', '==', status), orderBy('createdAt', 'desc')]
      );
    } catch (error) {
      console.error('Error getting orders by status:', error);
      throw error;
    }
  }

  /**
   * Real-time listener for a single order
   */
  orderListener(orderId: string): Observable<Order | null> {
    return this.firestoreService.documentListener<Order>(
      this.ORDERS_COLLECTION,
      orderId
    );
  }

  /**
   * Real-time listener for customer orders
   */
  customerOrdersListener(customerId: string): Observable<Order[]> {
    const { where, orderBy } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<Order>(
      this.ORDERS_COLLECTION,
      [where('customerId', '==', customerId), orderBy('createdAt', 'desc')]
    );
  }

  /**
   * Add message to order
   */
  async addMessage(
    orderId: string,
    senderId: string,
    senderEmail: string,
    senderRole: 'admin' | 'customer' | 'designer',
    message: string,
    attachments?: string[]
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const messageData: Omit<OrderMessage, 'id'> = {
        orderId,
        senderId,
        senderEmail,
        senderRole,
        message,
        attachments: attachments || [],
        createdAt: timestamp,
        isRead: false,
        readBy: [senderId] // Sender has already "read" their own message
      };

      await this.firestoreService.setDocument<Omit<OrderMessage, 'id'>>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
        messageId,
        messageData
      );
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Get messages for an order
   */
  async getOrderMessages(orderId: string): Promise<OrderMessage[]> {
    try {
      const { orderBy } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<OrderMessage>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
        [orderBy('createdAt', 'asc')]
      );
    } catch (error) {
      console.error('Error getting order messages:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(orderId: string, messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.firestoreService.getDocument<OrderMessage>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
        messageId
      );

      if (message && !message.readBy.includes(userId)) {
        await this.firestoreService.updateDocument(
          `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
          messageId,
          {
            readBy: [...message.readBy, userId],
            isRead: true
          }
        );
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Real-time listener for order messages
   */
  orderMessagesListener(orderId: string): Observable<OrderMessage[]> {
    const { orderBy } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<OrderMessage>(
      `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
      [orderBy('createdAt', 'asc')]
    );
  }

  /**
   * Add site images to order
   */
  async addSiteImages(orderId: string, imageUrls: string[]): Promise<void> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const updatedImages = [...order.siteImages, ...imageUrls];

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        { siteImages: updatedImages }
      );
    } catch (error) {
      console.error('Error adding site images:', error);
      throw error;
    }
  }

  /**
   * Add design files to order
   */
  async addDesignFiles(orderId: string, fileUrls: string[]): Promise<void> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const updatedFiles = [...order.designFiles, ...fileUrls];

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        { designFiles: updatedFiles }
      );
    } catch (error) {
      console.error('Error adding design files:', error);
      throw error;
    }
  }
}
