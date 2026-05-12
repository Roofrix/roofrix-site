import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { StorageService } from './storage.service';
import { Observable } from 'rxjs';
import { isValidStatusTransition, getAllowedNextStatuses } from '../constants/order.constants';

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

  // Timer pause/resume
  remainingTimeMs?: number;  // Remaining ms when order left in_progress
  resumedAt?: any;           // Timestamp when order re-entered in_progress

  // Soft delete
  isDeleted?: boolean;
  deletedAt?: any;

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
        status: 'in_progress',
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

      const order: Omit<Order, 'id'> = {
        orderNumber,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        totalPrice: data.totalPrice,
        status: 'in_progress',
        statusTimeline: [initialStatusEntry],
        priority: isRushOrder ? 'high' : data.priority,
        rushDeadline: rushDeadline,
        createdAt: timestamp,
        updatedAt: timestamp,
        workStartedAt: timestamp,
        items: data.items,
      };

      await this.firestoreService.setDocument<Omit<Order, 'id'>>(
        this.ORDERS_COLLECTION,
        orderNumber,
        order
      );

      return orderNumber;
    } catch (error) {
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
      // Validate status transition
      const currentOrder = await this.getOrder(orderId);
      if (!currentOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (!isValidStatusTransition(currentOrder.status, newStatus)) {
        const allowed = getAllowedNextStatuses(currentOrder.status);
        throw new Error(
          `Invalid status transition from "${currentOrder.status}" to "${newStatus}". ` +
          `Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal status)'}`
        );
      }

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
      // Note: updatedAt is auto-appended by firestoreService.updateDocument
      const updateData: any = {
        status: newStatus,
        statusTimeline: arrayUnion(timelineEntry),
      };

      // Snapshot remaining time when leaving in_progress (pause timer)
      if (currentOrder.status === 'in_progress' && newStatus !== 'in_progress') {
        const now = Date.now();
        const isRush = (currentOrder.items || []).some(item =>
          item.addons?.some(addon =>
            addon.name?.toLowerCase().includes('rush') || addon.id?.includes('rush')
          )
        );
        const totalAllowedMs = isRush ? 2 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

        let remaining: number;
        if (currentOrder.remainingTimeMs != null && currentOrder.resumedAt) {
          // Was paused before — calculate from last resume
          const resumedDate = currentOrder.resumedAt.toDate ? currentOrder.resumedAt.toDate() : new Date(currentOrder.resumedAt);
          remaining = currentOrder.remainingTimeMs - (now - resumedDate.getTime());
        } else {
          // First run — calculate from creation
          const createdDate = currentOrder.createdAt.toDate ? currentOrder.createdAt.toDate() : new Date(currentOrder.createdAt);
          remaining = totalAllowedMs - (now - createdDate.getTime());
        }
        updateData.remainingTimeMs = remaining;
      }

      // Set workStartedAt + resumedAt when entering in_progress
      if (newStatus === 'in_progress') {
        updateData.workStartedAt = timestamp;
        updateData.resumedAt = timestamp;
      }

      if (newStatus === 'completed') {
        updateData.completedAt = timestamp;
      }

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        updateData
      );
    } catch (error) {
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
        isRead: false
      };

      await this.firestoreService.setDocument<Omit<OrderMessage, 'id'>>(
        `${this.ORDERS_COLLECTION}/${orderId}/${this.MESSAGES_COLLECTION}`,
        messageId,
        messageData
      );
    } catch (error) {
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
   * Soft delete / cancel an order.
   * Sets status to 'cancelled', adds a timeline entry, and marks as deleted.
   */
  async deleteOrder(
    orderId: string,
    cancelledBy?: string,
    cancelledByEmail?: string
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();
      const { arrayUnion } = this.firestoreService.getArrayHelpers();

      const timelineEntry: StatusTimelineEntry = {
        status: 'cancelled',
        changedAt: timestamp,
        changedBy: cancelledBy || 'system',
        changedByEmail: cancelledByEmail || 'system',
        notes: 'Order cancelled'
      };

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        {
          status: 'cancelled',
          statusTimeline: arrayUnion(timelineEntry),
          isDeleted: true,
          deletedAt: timestamp,
        }
      );
    } catch (error) {
      throw error;
    }
  }
}
