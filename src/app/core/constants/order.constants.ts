import { OrderStatus } from '../services/order.service';

/** Statuses that count as "completed" for filtering */
export const COMPLETED_STATUSES = new Set<string>([
  'completed',
  // Legacy
  'customer_approved',
  'project_closed',
]);

/** Statuses that count as "cancelled" for filtering */
export const CANCELLED_STATUSES = new Set<string>([
  'cancelled',
]);

/** Terminal statuses — no further transitions allowed */
const TERMINAL_STATUSES = new Set<OrderStatus>([]);

/** Valid status transitions map */
const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  'in_progress': ['completed', 'cancelled'],
  'completed': ['in_progress', 'cancelled'],
  'cancelled': ['in_progress', 'completed'],
  // Legacy statuses — allow transitioning out of old statuses
  'order_placed': ['in_progress', 'completed', 'cancelled'],
  'payment_pending': ['in_progress', 'completed', 'cancelled'],
  'payment_accepted': ['in_progress', 'completed', 'cancelled'],
  'work_not_started': ['in_progress', 'completed', 'cancelled'],
  'on_hold': ['in_progress', 'completed', 'cancelled'],
  'work_completed': ['completed', 'cancelled'],
  'sent_for_review': ['completed', 'cancelled'],
  'customer_approved': ['completed', 'cancelled'],
  'project_closed': [],
  'pending': ['in_progress', 'completed', 'cancelled'],
  'review': ['completed', 'cancelled'],
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  if (currentStatus === newStatus) return false;
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Get allowed next statuses for a given current status
 */
export function getAllowedNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/** Human-readable status labels */
export const STATUS_LABELS: Record<string, string> = {
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  // Legacy labels (for old orders)
  'order_placed': 'Order Placed',
  'payment_pending': 'Payment Pending',
  'payment_accepted': 'Payment Accepted',
  'work_not_started': 'Work Not Started',
  'on_hold': 'On Hold',
  'work_completed': 'Work Completed',
  'sent_for_review': 'Sent for Review',
  'customer_approved': 'Customer Approved',
  'project_closed': 'Project Closed',
  'pending': 'Pending',
  'review': 'Under Review',
};

/** CSS class per status */
export const STATUS_CLASSES: Record<string, string> = {
  'order_placed': 'status-order-placed',
  'payment_pending': 'status-payment-pending',
  'payment_accepted': 'status-payment-accepted',
  'work_not_started': 'status-work-not-started',
  'in_progress': 'status-in-progress',
  'on_hold': 'status-on-hold',
  'work_completed': 'status-work-completed',
  'sent_for_review': 'status-sent-for-review',
  'customer_approved': 'status-customer-approved',
  'project_closed': 'status-project-closed',
  'pending': 'status-pending',
  'review': 'status-review',
  'completed': 'status-completed',
  'cancelled': 'status-cancelled',
};
