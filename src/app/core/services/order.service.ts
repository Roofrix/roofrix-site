import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { StorageService } from './storage.service';
import { Observable } from 'rxjs';

export type OrderStatus =
  | 'order_placed'
  | 'payment_pending'
  | 'payment_accepted'
  | 'work_not_started'
  | 'in_progress'
  | 'on_hold'
  | 'work_completed'
  | 'sent_for_review'
  | 'customer_approved'
  | 'project_closed'
  // Legacy statuses for backward compatibility
  | 'pending'
  | 'review'
  | 'completed'
  | 'cancelled';

/**
 * Snapshot of selected report type at time of order
 * (Prices are captured so historical orders reflect original pricing)
 */
export interface OrderReportType {
  id: string;
  name: string;
  description: string;
  price: number;
}

/**
 * Snapshot of selected addon at time of order
 */
export interface OrderAddon {
  id: string;
  name: string;
  price: number;
}

/**
 * Status change entry for timeline
 */
export interface StatusTimelineEntry {
  status: OrderStatus;
  changedAt: any;
  changedBy: string;
  changedByEmail: string;
  notes?: string;
}

/**
 * Individual item in a multi-item order (cart checkout)
 */
export interface SiteImage {
  url: string;
  name: string;
}

export interface OrderItem {
  projectName: string;
  projectAddress: string;
  location: { lat: number; lng: number };
  reportType: OrderReportType;
  addons: OrderAddon[];
  structureCategory: string;
  structureCategoryName: string;
  structureCategorySqRange: string;
  primaryPitch?: string;
  secondaryPitch?: string;
  structureType?: string;
  specialInstructions: string;
  basePrice: number;
  addonsTotal: number;
  totalPrice: number;
  siteImages?: SiteImage[];
}

/**
 * Main Order interface
 */
export interface Order {
  id: string;
  orderNumber: string;
  projectName: string;

  // Customer info
  customerId: string;
  customerEmail: string;
  customerName: string;

  // Pricing (totals across all items)
  totalPrice: number;

  // Current Status
  status: OrderStatus;
  statusTimeline: StatusTimelineEntry[];
  priority: 'low' | 'medium' | 'high';
  rushDeadline?: any;

  // Timestamps
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  workStartedAt?: any;

  // Items (always at least one)
  items: OrderItem[];
}

/**
 * Data required to create a new order
 */
export interface CreateOrderData {
  customerId: string;
  customerEmail: string;
  customerName: string;
  totalPrice: number;
  priority: 'low' | 'medium' | 'high';
  items: OrderItem[];
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderEmail: string;
  senderRole: 'admin' | 'customer';
  message: string;
  attachments?: string[]; // Firebase Storage URLs
  createdAt: any;
  isRead: boolean;
  readBy: string[]; // Array of user IDs who have read the message
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private firestoreService = inject(FirestoreService);
  private storageService = inject(StorageService);

  private readonly ORDERS_COLLECTION = 'orders';
  private readonly MESSAGES_COLLECTION = 'messages';

  /**
   * Generate sequential order number using Firestore counter
   */
  private async generateOrderNumber(): Promise<string> {
    const seq = await this.firestoreService.incrementCounter('system', 'counters', 'orderNumber');
    return seq.toString();
  }

  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData, createdBy: string): Promise<string> {
    try {
      const timestamp = this.firestoreService.getTimestamp();
      const orderNumber = await this.generateOrderNumber();

      const initialStatusEntry: StatusTimelineEntry = {
        status: 'order_placed',
        changedAt: timestamp,
        changedBy: createdBy,
        changedByEmail: data.customerEmail,
        notes: 'Order created'
      };

      // Check rush across all items
      const isRushOrder = data.items.some(item =>
        item.addons.some(addon =>
          addon.name.toLowerCase().includes('rush') || addon.id.includes('rush')
        )
      );

      const rushDeadline = isRushOrder
        ? new Date(Date.now() + 2 * 60 * 60 * 1000)
        : null;

      // Generate project name
      const firstItem = data.items[0];
      const projectName = data.items.length > 1
        ? `${data.items.length} Projects - ${firstItem.projectName}`
        : `${firstItem.reportType.name} - ${firstItem.projectAddress}`;

      const order: Omit<Order, 'id'> = {
        orderNumber,
        projectName,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        totalPrice: data.totalPrice,
        status: 'order_placed',
        statusTimeline: [initialStatusEntry],
        priority: isRushOrder ? 'high' : data.priority,
        rushDeadline: rushDeadline,
        createdAt: timestamp,
        updatedAt: timestamp,
        items: data.items,
      };

      await this.firestoreService.setDocument<Omit<Order, 'id'>>(
        this.ORDERS_COLLECTION,
        orderNumber,
        order
      );

      return orderNumber;
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

  async updateOrder(orderId: string, data: Partial<Order>): Promise<void> {
    await this.firestoreService.updateDocument(this.ORDERS_COLLECTION, orderId, data);
  }

  /**
   * Update order status with timeline entry
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
      const { arrayUnion } = this.firestoreService.getArrayHelpers();

      // Create new timeline entry
      const timelineEntry: StatusTimelineEntry = {
        status: newStatus,
        changedAt: timestamp,
        changedBy,
        changedByEmail,
        notes: notes || ''
      };

      // Build update data — use arrayUnion to avoid an extra read
      const updateData: any = {
        status: newStatus,
        statusTimeline: arrayUnion(timelineEntry),
        updatedAt: timestamp
      };

      // Set workStartedAt when work begins
      if (newStatus === 'in_progress') {
        updateData.workStartedAt = timestamp;
      }

      if (newStatus === 'project_closed' || newStatus === 'completed') {
        updateData.completedAt = timestamp;
      }

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        updateData
      );
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Get status timeline for an order
   */
  async getStatusTimeline(orderId: string): Promise<StatusTimelineEntry[]> {
    try {
      const order = await this.getOrder(orderId);
      return order?.statusTimeline || [];
    } catch (error) {
      console.error('Error getting status timeline:', error);
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
   * Get all orders (Admin only) - with pagination for scalability
   */
  async getAllOrders(pageSize: number = 100): Promise<Order[]> {
    try {
      const { orderBy, limit } = this.firestoreService.getQueryHelpers();
      return await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [orderBy('createdAt', 'desc'), limit(pageSize)]
      );
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw error;
    }
  }

  /**
   * Get paginated orders (Admin only) - for infinite scroll or pagination
   */
  async getOrdersPaginated(
    pageSize: number = 50,
    lastOrderDate?: any
  ): Promise<{ orders: Order[]; hasMore: boolean }> {
    try {
      const { orderBy, limit, startAfter } = this.firestoreService.getQueryHelpers();
      const constraints: any[] = [orderBy('createdAt', 'desc'), limit(pageSize + 1)];

      if (lastOrderDate) {
        constraints.push(startAfter(lastOrderDate));
      }

      const orders = await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        constraints
      );

      const hasMore = orders.length > pageSize;
      return {
        orders: hasMore ? orders.slice(0, pageSize) : orders,
        hasMore
      };
    } catch (error) {
      console.error('Error getting paginated orders:', error);
      throw error;
    }
  }

  /**
   * Get order count by status (for dashboard stats)
   */
  async getOrderCountByStatus(status: OrderStatus): Promise<number> {
    try {
      const { where } = this.firestoreService.getQueryHelpers();
      const orders = await this.firestoreService.getDocuments<Order>(
        this.ORDERS_COLLECTION,
        [where('status', '==', status)]
      );
      return orders.length;
    } catch (error) {
      console.error('Error getting order count:', error);
      return 0;
    }
  }

  /**
   * Real-time listener for all orders (Admin) - with limit for performance
   */
  allOrdersListener(limitCount: number = 50): Observable<Order[]> {
    const { orderBy, limit } = this.firestoreService.getQueryHelpers();
    return this.firestoreService.collectionListener<Order>(
      this.ORDERS_COLLECTION,
      [orderBy('createdAt', 'desc'), limit(limitCount)]
    );
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
    senderRole: 'admin' | 'customer',
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
        readBy: [senderId]
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
   * Delete an order (messages, storage files, then document)
   */
  async deleteOrder(orderId: string): Promise<void> {
    try {
      // 1. Get order to find siteImages URLs
      const order = await this.getOrder(orderId);

      // 2. Delete messages sub-collection
      const messages = await this.getOrderMessages(orderId);
      for (const msg of messages) {
        await this.firestoreService.deleteDocument(
          `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
          msg.id
        );
      }

      // 3. Delete storage files from all items
      if (order?.items) {
        const allUrls = order.items
          .flatMap(item => (item.siteImages || []).map(img => img.url));
        if (allUrls.length > 0) {
          await this.storageService.deleteMultipleFiles(allUrls).catch(err => {
            console.warn('Some storage files could not be deleted:', err);
          });
        }
      }

      // 4. Delete order document
      await this.firestoreService.deleteDocument(
        this.ORDERS_COLLECTION,
        orderId
      );
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }
}
