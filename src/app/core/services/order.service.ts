import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
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
  changedByRole: 'admin' | 'customer' | 'designer' | 'system';
  notes?: string;
}

/**
 * Individual item in a multi-item order (cart checkout)
 */
export interface OrderItem {
  projectName: string;
  projectAddress: string;
  location: { lat: number; lng: number; address?: string };
  reportType: OrderReportType;
  addons: OrderAddon[];
  structureCategory: string;
  structureCategoryName: string;
  structureCategorySqRange: string;
  specialInstructions: string;
  basePrice: number;
  addonsTotal: number;
  totalPrice: number;
}

/**
 * Main Order interface
 */
export interface Order {
  id: string;
  orderNumber: string; // e.g., "ORD-2024-0001"

  // Customer info
  customerId: string;
  customerEmail: string;
  customerName: string;

  // Assigned designer
  assignedDesignerId?: string;
  assignedDesignerEmail?: string;

  // Address
  projectAddress: string;

  // Location coordinates
  latitude?: number | null;
  longitude?: number | null;
  location?: { lat: number; lng: number; address: string } | null;

  // Selected Report Type (snapshot with price at time of order)
  reportType: OrderReportType;

  // Selected Addons (snapshot with prices at time of order)
  addons: OrderAddon[];

  // Structure Category (Basic, Moderate, Complex)
  structureCategory: string;
  structureCategoryName: string;
  structureCategorySqRange: string;

  // Roof Pitch (optional)
  primaryPitch?: string;
  secondaryPitch?: string;

  // Special Instructions
  specialInstructions?: string;

  // Pricing (calculated at time of order)
  basePrice: number;       // Report type price
  addonsTotal: number;     // Sum of addon prices
  totalPrice: number;      // basePrice + addonsTotal

  // Current Status
  status: OrderStatus;

  // Status Timeline (embedded array for quick access)
  statusTimeline: StatusTimelineEntry[];

  // File references
  siteImages: string[];    // Firebase Storage URLs (customer uploads)
  designFiles: string[];   // Firebase Storage URLs (designer uploads)

  // Timestamps
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  workStartedAt?: any;  // When work actually started (for running timer)
  rushDeadline?: any;   // Deadline for rush orders (2 hours from order)

  // Priority (auto-set to 'high' if Rush addon selected)
  priority: 'low' | 'medium' | 'high';

  // Multi-item order support (from cart checkout)
  items?: OrderItem[];

  // Legacy fields (for backward compatibility)
  projectName?: string;
  projectDescription?: string;
  roofType?: string;
  estimatedArea?: number;
  structureType?: string; // Legacy - use structureCategory instead
}

/**
 * Data required to create a new order
 */
export interface CreateOrderData {
  // Customer info
  customerId: string;
  customerEmail: string;
  customerName: string;

  // Address
  projectAddress: string;

  // Location coordinates
  latitude?: number | null;
  longitude?: number | null;
  location?: { lat: number; lng: number; address: string } | null;

  // Selected Report Type (with current price)
  reportType: OrderReportType;

  // Selected Addons (with current prices)
  addons: OrderAddon[];

  // Structure Category (Basic, Moderate, Complex)
  structureCategory: string;
  structureCategoryName: string;
  structureCategorySqRange: string;

  // Roof Pitch (optional)
  primaryPitch?: string;
  secondaryPitch?: string;

  // Special Instructions
  specialInstructions?: string;

  // Calculated pricing
  basePrice: number;
  addonsTotal: number;
  totalPrice: number;

  // Priority
  priority: 'low' | 'medium' | 'high';

  // Multi-item order support (from cart checkout)
  items?: OrderItem[];
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

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private firestoreService = inject(FirestoreService);

  private readonly ORDERS_COLLECTION = 'orders';
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
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create initial status timeline entry
      const initialStatusEntry: StatusTimelineEntry = {
        status: 'order_placed',
        changedAt: timestamp,
        changedBy: createdBy,
        changedByEmail: data.customerEmail,
        changedByRole: 'customer',
        notes: 'Order created'
      };

      // Check if this is a rush order (has 2hr rush addon)
      const isRushOrder = data.addons.some(addon =>
        addon.name.toLowerCase().includes('rush') || addon.id.includes('rush')
      );

      // Calculate rush deadline (2 hours from now) if rush order
      const rushDeadline = isRushOrder
        ? new Date(Date.now() + 2 * 60 * 60 * 1000)
        : null;

      // Generate project name from report type and address
      const projectName = data.items && data.items.length > 1
        ? `${data.items.length} Projects - ${data.items[0].projectName}`
        : `${data.reportType.name} - ${data.projectAddress}`;

      const order: Omit<Order, 'id'> = {
        orderNumber,
        customerId: data.customerId,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        projectAddress: data.projectAddress,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        location: data.location || null,
        reportType: data.reportType,
        addons: data.addons,
        // Structure category
        structureCategory: data.structureCategory,
        structureCategoryName: data.structureCategoryName,
        structureCategorySqRange: data.structureCategorySqRange,
        primaryPitch: data.primaryPitch || '',
        secondaryPitch: data.secondaryPitch || '',
        specialInstructions: data.specialInstructions || '',
        basePrice: data.basePrice,
        addonsTotal: data.addonsTotal,
        totalPrice: data.totalPrice,
        status: 'order_placed',
        statusTimeline: [initialStatusEntry],
        siteImages: [],
        designFiles: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        rushDeadline: rushDeadline,
        priority: data.priority,
        // Multi-item order support
        items: data.items || undefined,
        // Legacy fields
        projectName: projectName,
        projectDescription: data.specialInstructions || ''
      };

      await this.firestoreService.setDocument<Omit<Order, 'id'>>(
        this.ORDERS_COLLECTION,
        orderId,
        order
      );

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
   * Update order status with timeline entry
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    changedByEmail: string,
    changedByRole: 'admin' | 'customer' | 'designer',
    notes?: string
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();

      // Get current order to append to timeline
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Create new timeline entry
      const timelineEntry: StatusTimelineEntry = {
        status: newStatus,
        changedAt: timestamp,
        changedBy,
        changedByEmail,
        changedByRole,
        notes: notes || ''
      };

      // Update order with new status and timeline
      const updateData: Partial<Order> = {
        status: newStatus,
        statusTimeline: [...order.statusTimeline, timelineEntry],
        updatedAt: timestamp
      };

      // Set workStartedAt when work begins
      if (newStatus === 'in_progress' && !order.workStartedAt) {
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
   * Assign designer to order
   */
  async assignDesigner(
    orderId: string,
    designerId: string,
    designerEmail: string,
    assignedBy: string,
    assignedByEmail: string
  ): Promise<void> {
    try {
      const timestamp = this.firestoreService.getTimestamp();

      // Get current order
      const order = await this.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Create timeline entry for assignment
      const timelineEntry: StatusTimelineEntry = {
        status: order.status,
        changedAt: timestamp,
        changedBy: assignedBy,
        changedByEmail: assignedByEmail,
        changedByRole: 'admin',
        notes: `Assigned to designer: ${designerEmail}`
      };

      await this.firestoreService.updateDocument(
        this.ORDERS_COLLECTION,
        orderId,
        {
          assignedDesignerId: designerId,
          assignedDesignerEmail: designerEmail,
          statusTimeline: [...order.statusTimeline, timelineEntry],
          updatedAt: timestamp
        }
      );
    } catch (error) {
      console.error('Error assigning designer:', error);
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

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string): Promise<void> {
    try {
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
