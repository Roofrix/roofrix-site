import { OrderStatus } from '../services/order.service';

/** Statuses that count as "completed" for filtering */
export const COMPLETED_STATUSES = new Set<string>([
  'customer_approved',
  'project_closed',
  'completed',
]);

/** Statuses that count as "cancelled" for filtering */
export const CANCELLED_STATUSES = new Set<string>([
  'cancelled',
]);

/** Terminal statuses — no further transitions allowed */
const TERMINAL_STATUSES = new Set<OrderStatus>(['project_closed', 'cancelled', 'completed']);

/** Valid status transitions map */
const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  'order_placed': ['payment_pending', 'payment_accepted', 'work_not_started', 'in_progress', 'cancelled'],
  'payment_pending': ['payment_accepted', 'cancelled'],
  'payment_accepted': ['work_not_started', 'in_progress', 'cancelled'],
  'work_not_started': ['in_progress', 'on_hold', 'cancelled'],
  'in_progress': ['on_hold', 'work_completed', 'cancelled'],
  'on_hold': ['in_progress', 'cancelled'],
  'work_completed': ['sent_for_review', 'in_progress', 'cancelled'],
  'sent_for_review': ['customer_approved', 'in_progress', 'cancelled'],
  'customer_approved': ['project_closed'],
  'project_closed': [],
  // Legacy statuses
  'pending': ['in_progress', 'review', 'cancelled'],
  'review': ['completed', 'in_progress', 'cancelled'],
  'completed': ['project_closed'],
  'cancelled': [],
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
  'order_placed': 'Order Placed',
  'payment_pending': 'Payment Pending',
  'payment_accepted': 'Payment Accepted',
  'work_not_started': 'Work Not Started',
  'in_progress': 'In Progress',
  'on_hold': 'On Hold',
  'work_completed': 'Work Completed',
  'sent_for_review': 'Sent for Review',
  'customer_approved': 'Customer Approved',
  'project_closed': 'Project Closed',
  'pending': 'Pending',
  'review': 'Under Review',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
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
