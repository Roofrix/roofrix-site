# Roofrix - Roof Measurement Ordering Platform

## Overview
A web platform where customers order roof measurement reports and admins manage those orders. Built with Angular 21 and Firebase.

**Live**: https://roofrix-d116a.web.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 21 (standalone components) |
| Auth | Firebase Authentication (email/password) with email verification + password reset |
| Database | Cloud Firestore |
| File Storage | Firebase Storage |
| Hosting | Firebase Hosting |
| Maps | Google Maps JavaScript API + Places Autocomplete + Geocoding API |

---

## Roles

| Role | Access |
|------|--------|
| **customer** | Create orders, upload photos, view order history (Open/Completed/Cancelled tabs, no status column), cart (no cancel — admin only) |
| **admin** | View all orders (with address column), view uploaded images/PDFs, update status (cancel/delete button hidden — commented out for future re-enable) |

---

## Project Structure

```
src/
  app/
    core/
      guards/
        auth.guard.ts              # Redirects unauthenticated users to /signin
        role.guard.ts              # adminGuard, customerGuard, dashboardGuard
      models/
        user.interface.ts
      constants/
        order.constants.ts         # Shared status labels, CSS classes, transition validation, filter sets
      services/
        auth.service.ts            # Firebase Auth (signup, signin, signout, email verification, password reset) + loads pricing on login
        user.service.ts            # User profiles CRUD
        order.service.ts           # Orders CRUD, status updates with transition validation, messages, file URLs
        cart.service.ts            # In-memory + sessionStorage cart
        storage.service.ts         # Firebase Storage uploads
        file-transfer.service.ts   # In-memory file passing between pages (per cart item)
        pricing.service.ts         # Hardcoded definitions + Firestore prices (loaded on login, excludes items with missing prices)
        firestore.service.ts       # Generic Firestore wrapper + atomic counter
        email-notification.service.ts # EmailJS admin notifications (async, returns success/failure)
    layouts/
      public-layout/               # Wrapper for public pages (uses shared navbar + footer)
      dashboard-layout/            # Wrapper for dashboard pages (uses shared navbar, no footer)
    shared/
      navbar/                      # Shared navbar for all pages (nav links, order menu, cart, user menu, mobile sign out)
      pipes/
        format-date.pipe.ts        # Shared FormatDatePipe (short, long, datetime, time formats)
    pages/
      home/                        # Landing page with "Order Now" button (uses basic structure pricing)
      features/
      about/
      contact/
      auth/
        signin/
        signup/
        verify-email/              # Post-signup email verification prompt
        forgot-password/           # Password reset request form
      dashboard/
        customer/
          new-order/               # Order form with Google Maps
          order-review/            # Review + confirm + file upload (structure category hidden from UI)
          orders/                  # Order history list (Open/Completed/Cancelled tabs, welcome header, stats, table, search, pagination, no status column)
            order-detail/          # Single order detail view (order-summary style per item, status timeline)
          cart/                    # Shopping cart (structure category hidden from UI)
        admin/
          orders/                  # Admin order management (Open/Completed/Cancelled tabs, welcome header, stats, table with address column, search, pagination, image gallery, exact pin map with fixed height)
      errors/
        not-found/
  environments/
    environment.ts                 # Dev config (Firebase + Google Maps API key)
    environment.prod.ts            # Prod config
  index.html                       # Google Maps script tag
  styles.scss                      # Global styles
```

---

## Routes

### Public (no auth required)
| Path | Page |
|------|------|
| `/` | Home |
| `/features` | Features |
| `/about` | About |
| `/contact` | Contact |
| `/signin` | Sign In |
| `/signup` | Sign Up |
| `/verify-email` | Email verification prompt (after signup) |
| `/forgot-password` | Password reset request |
| `/404` | Not Found |

### Dashboard (auth required)
| Path | Guard | Page |
|------|-------|------|
| `/dashboard/customer/new-order` | customerGuard | Order form |
| `/dashboard/customer/order-review` | customerGuard | Review + confirm |
| `/dashboard/customer/orders` | customerGuard | Order history |
| `/dashboard/customer/orders/:orderId` | customerGuard | Order detail |
| `/dashboard/customer/cart` | customerGuard | Shopping cart |
| `/dashboard/admin/orders` | adminGuard | Admin order management (Open/Completed/Cancelled tabs) |

---

## Firestore Database Schema

### Document Relationship Diagram

```
users (collection)
  └── {uid} (document)
        │
        │ customerId (references)
        ▼
orders (collection)
  └── {orderId} (document)
        │
        │ orderId (parent)
        ▼
        messages (sub-collection)
          └── {messageId} (document)
                │
                │ senderId (references users/{uid})
                ▼

system (collection)
  ├── order (document) ──── pricing: { basic, moderate, complex } each with { reportTypes[], addons[] } (id + price only)
  └── counters (document) ── { orderNumber: number } (sequential order number counter)

Firebase Storage
  └── {userId}/
        └── {orderId}/
              └── {uniqueFileName}  ──── URL stored in orders.siteImages[] or items[].siteImages[]
```

---

### Collection: `users`
**Document ID**: Firebase Auth UID

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | User email |
| `role` | string | `'admin'` or `'customer'` |
| `name` | string | Optional |
| `phoneNumber` | string | Optional |
| `company` | string | Optional |
| `createdAt` | timestamp | Account created |
| `updatedAt` | timestamp | Last profile update (auto-set by firestoreService) |
| `lastLoginAt` | timestamp | Updated on each login |
| `isActive` | boolean | Account active status |

**Links to**: Referenced by `orders.customerId`, `orders.statusTimeline[].changedBy`, `messages.senderId`

---

### Collection: `orders`
**Document ID**: Sequential number starting from `10001` (e.g., `10001`, `10002`, ...)

Order-level fields (shared across all items):

| Field | Type | Description | Links to |
|-------|------|-------------|----------|
| `orderNumber` | string | Sequential number (e.g., `10001`) | `system/counters.orderNumber` |
| `projectName` | string | Auto-generated display name | |
| `customerId` | string | Who placed the order | `users/{uid}` |
| `customerEmail` | string | Snapshot at order time | |
| `customerName` | string | Snapshot at order time | |
| `totalPrice` | number | Sum of all items' totalPrice | |
| `status` | string | Current status | |
| `statusTimeline[]` | array | See StatusTimeline below | |
| `priority` | string | `'low'`, `'medium'`, `'high'` | |
| `rushDeadline` | timestamp | Only if rush addon selected | |
| `createdAt` | timestamp | | |
| `updatedAt` | timestamp | | |
| `completedAt` | timestamp | Optional | |
| `workStartedAt` | timestamp | Optional | |
| `isDeleted` | boolean | Soft delete flag (optional, defaults to false) | |
| `deletedAt` | timestamp | When soft-deleted (optional) | |
| `items[]` | array | Always at least 1 item | See items[] below |

#### statusTimeline[] entry

| Field | Type | Links to |
|-------|------|----------|
| `status` | OrderStatus | |
| `changedAt` | timestamp | |
| `changedBy` | string | `users/{uid}` |
| `changedByEmail` | string | |
| `notes` | string | |

#### items[] entry (always present, at least 1)

Per-item data — all project-specific details live here:

| Field | Type |
|-------|------|
| `projectName` | string |
| `projectAddress` | string |
| `location` | `{ lat, lng }` |
| `reportType` | `{ id, name, description, price }` |
| `addons[]` | `[{ id, name, price }]` |
| `structureCategory` | string |
| `structureCategoryName` | string |
| `structureCategorySqRange` | string |
| `primaryPitch` | string (optional) |
| `secondaryPitch` | string (optional) |
| `specialInstructions` | string |
| `basePrice` | number |
| `addonsTotal` | number |
| `totalPrice` | number |
| `siteImages` | `[{ url, name }]` (optional, per-item uploaded files) |

---

### Sub-collection: `orders/{orderId}/messages`
**Document ID**: `msg_{timestamp}_{random9chars}`

| Field | Type | Description | Links to |
|-------|------|-------------|----------|
| `orderId` | string | Parent order | `orders/{orderId}` |
| `senderId` | string | Who sent it | `users/{uid}` |
| `senderEmail` | string | | |
| `senderRole` | string | `'admin'` or `'customer'` | |
| `message` | string | Message text | |
| `attachments[]` | string[] | Storage URLs | `Storage: {uid}/{orderId}/*` |
| `createdAt` | timestamp | | |
| `isRead` | boolean | | |

---

### Collection: `system`

#### Document: `order` — Pricing config

Stores only `id` + `price` per item. Names, descriptions, badges, categories, and structure types are hardcoded in `pricing.service.ts`. Loaded once on login by `PricingService.loadPricing()`.

| Field | Type | Description |
|-------|------|-------------|
| `basic` | object | Prices for basic structures |
| `moderate` | object | Prices for moderate structures |
| `complex` | object | Prices for complex structures |

Each category object:

| Field | Type | Description |
|-------|------|-------------|
| `reportTypes[]` | array | `{ id, price }` |
| `addons[]` | array | `{ id, price }` |

#### Document: `counters` — Sequential counters

| Field | Type | Description |
|-------|------|-------------|
| `orderNumber` | number | Last used order number (incremented atomically via `runTransaction`) |

---

## Order Status Flow

```
in_progress → completed
      |
      v
  cancelled
```

Orders are created directly with `in_progress` status. Only 3 statuses exist:
- **In Progress** — order is being worked on (set on creation)
- **Completed** — work is done
- **Cancelled** — order was cancelled

Legacy statuses from old orders (backward compatibility): `order_placed`, `payment_pending`, `payment_accepted`, `work_not_started`, `on_hold`, `work_completed`, `sent_for_review`, `customer_approved`, `project_closed`, `pending`, `review`. These can transition to `in_progress`, `completed`, or `cancelled`.

### Status Transition Validation

Status changes are validated via `isValidStatusTransition()` in `order.constants.ts`. Invalid transitions throw an error. The admin status modal dropdown only shows valid next statuses, and the "Update Status" button is disabled for terminal statuses.

**Terminal statuses** (no further transitions): `completed`, `cancelled`

**Valid transitions:**
| From | Allowed To |
|------|-----------|
| `in_progress` | `completed`, `cancelled` |
| `completed` | *(terminal)* |
| `cancelled` | *(terminal)* |

### Orders Tab Classification (both admin and customer)

Both admin and customer orders pages split orders into three tabs using shared constants from `order.constants.ts`:

| Tab | Statuses |
|-----|----------|
| **Open** (default) | `order_placed`, `payment_pending`, `payment_accepted`, `work_not_started`, `in_progress`, `on_hold`, `work_completed`, `sent_for_review`, `pending` (legacy), `review` (legacy) — excludes `isDeleted` orders |
| **Completed** | `customer_approved`, `project_closed`, `completed` (legacy) — excludes `isDeleted` orders |
| **Cancelled** | `cancelled` status OR any order with `isDeleted === true` |

- **Both sides**: Client-side array filtering in `filterOrders()` with search and pagination
- **Page layout**: Welcome header with user name + 4 stat cards (Total Orders, Completed, In Progress, Cancelled) → Order History card with tabs, search, data table, and pagination footer
- **Cancel order**: Button hidden on both admin and customer sides (admin HTML commented out for future re-enable). Logic preserved in TS — `deleteOrder()` sets `status: 'cancelled'` + `isDeleted: true` + `deletedAt`
- **Stats**: Cancelled count includes `CANCELLED_STATUSES` or `isDeleted` orders
- **Keyboard**: All modals close on Escape key
- **Admin timer**: Countdown timer shows time remaining (8h standard, 2h rush). Once status reaches `work_completed` or later (or `cancelled`), timer stops and shows elapsed time taken (e.g., "3h 15m") with a blue `time-completed` badge.

---

## Firebase Storage

**Path**: `{userId}/{orderId}/{uniqueFileName}`

**Unique file naming**: `{originalName}_{timestamp}_{random}.{ext}`

**Security rules**:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{orderId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Supported**: JPG, PNG, PDF (max 10MB each)

**How files are tracked**:
- Files stored as `{ url, name }` objects in `items[].siteImages[]`
- Each item tracks its own uploaded files
- No outer-level `siteImages` on the order — all file references live inside items

---

## Google Maps Integration

**APIs**: Maps JavaScript API, Places Autocomplete, Geocoding API

**Key restrictions**: `localhost:*`, `roofrix-d116a.web.app/*`

**Flow**:
1. User types address -> Google Places Autocomplete shows suggestions
2. User selects suggestion -> pin placed on map, zooms to level 18
3. User clicks map -> pin placed, reverse geocode fills address
4. User drags pin -> reverse geocode updates address
5. User clicks "Confirm Location" -> location locked for order
6. Any map interaction after confirm -> resets to unconfirmed

**Admin view**: Map shows exact lat/lng pin (not address search), zoom level 18

---

## Application Flows

### Sign Up Flow
```
/signup page
  -> User enters email + password
  -> Firebase Auth createUserWithEmailAndPassword()
  -> Create Firestore document in users/{uid} with role: 'customer'
  -> Send verification email via sendEmailVerification()
  -> Sign out user (cannot access protected routes until verified)
  -> Redirect to /verify-email?email={email}
```

### Email Verification Flow
```
/verify-email page
  -> Shows "Check your inbox" message with user's email
  -> User clicks verification link in email -> Firebase marks emailVerified = true
  -> User navigates to /signin to log in
```

### Sign In Flow
```
/signin page
  -> User enters email + password
  -> Firebase Auth signInWithEmailAndPassword()
  -> Check emailVerified: if false -> sign out, show error + "Resend Verification Email" button
  -> If verified: Update lastLoginAt in users/{uid}
  -> PricingService.loadPricing() fetches system/order prices from Firestore
  -> Redirect to /
```

### Forgot Password Flow
```
/forgot-password page (linked from /signin)
  -> User enters email
  -> Firebase Auth sendPasswordResetEmail()
  -> Show success message: "Reset link sent"
  -> User clicks link in email -> sets new password on Firebase-hosted page
  -> User signs in with new password
```

### Single Order Flow (Proceed to Checkout)
```
/dashboard/customer/new-order
  -> Fill: address (Google Autocomplete), confirm pin, report type, addons, structure type, pitch, instructions, photos
  -> Click "Proceed to Checkout"
  -> Order data -> sessionStorage('orderData')
  -> Files -> FileTransferService.setFiles() (in-memory)
  -> Navigate to /dashboard/customer/order-review
  -> User clicks "Back" -> form restores all values from sessionStorage + files from FileTransferService

/dashboard/customer/order-review
  -> Display order summary with pricing breakdown
  -> Click "Confirm Order"
  -> 1. Validate location (lat/lng exist) and reportType (id + price exist)
  -> 2. Wrap form data into items[1] (single item)
  -> 3. Generate sequential order number (atomic counter: system/counters.orderNumber)
  -> 4. Create order document in Firestore orders/{orderId} with items[]
  -> 5. Upload files to Storage: {uid}/{orderId}/{file}
  -> 6. Store URLs on items[0].siteImages[] (warning shown if upload fails)
  -> 7. Send admin email notification (warning shown if email fails)
  -> 8. Show confirmation with order number
  -> 9. Clear all: sessionStorage (orderData, selectedStructureType) + FileTransferService
```

### Cart Order Flow (Add to Cart)
```
/dashboard/customer/new-order
  -> Fill form
  -> Click "Add to Cart"
  -> Cart item -> sessionStorage via CartService (returns cartItemId)
  -> Files -> FileTransferService.addCartItemFiles(cartItemId, files) (in-memory)
  -> Form resets all fields for next item

/dashboard/customer/cart
  -> View items, remove items (also removes per-item files), see total
  -> Clear Cart -> clears CartService + FileTransferService
  -> Click "Proceed to Checkout"
  -> Cart data -> sessionStorage('cartCheckout')
  -> Navigate to /dashboard/customer/order-review?fromCart=true

/dashboard/customer/order-review?fromCart=true
  -> Display all cart items
  -> Click "Confirm Order"
  -> 1. Loop through each cart item and create a SEPARATE order per item in Firestore
  -> 2. Upload files per item to Storage: {uid}/{orderId}/{file}
  -> 3. Store per-item URLs on items[0].siteImages[] per order (warning shown if any upload fails)
  -> 4. Send admin email notification PER ORDER (warning shown if email fails)
  -> 5. Show confirmation with ALL order numbers (e.g., "Order Numbers: 5, 6, 7")
  -> 6. "View Orders" button navigates to order list (not single order detail)
  -> 7. Clear all: CartService + FileTransferService + sessionStorage (cartCheckout, orderData, selectedStructureType)
```

### Admin Order Management Flow
```
/dashboard/admin/orders
  -> Real-time listener on all orders (allOrdersListener)
  -> Open/Completed/Cancelled tabs
  -> Table columns: Date, Order ID, Customer, Address, Report Type, Addons, Priority, Time, Actions
  -> Search by order number, customer name/email, address, report type, category
  -> Client-side pagination (10/25/50 per page)
  -> Click order -> view details modal (with item navigation for multi-item orders)
  -> View uploaded images (thumbnail gallery) and PDFs (download links)
  -> Map shows exact lat/lng pin location (fixed 350px height, not full panel)
  -> Change status -> dropdown shows only valid next statuses, button disabled for terminal statuses
     -> updateOrderStatus() validates transition, uses arrayUnion -> adds statusTimeline entry
  -> Cancel order -> sets status='cancelled' + timeline entry + isDeleted=true (moves to Cancelled tab)
  -> All modals close on Escape key
```

### Message Flow (per order)
```
Order Detail Page
  -> Messages loaded via orderMessagesListener() (real-time)
  -> User types message -> addMessage()
  -> Creates document in orders/{orderId}/messages/{msgId}
  -> Message appears in real-time for both customer and admin
  -> Attachments uploaded to Storage, URLs stored in message.attachments[]
```

---

## Services API Reference

### firestore.service.ts (Generic Wrapper)
| Method | Description |
|--------|-------------|
| `setDocument(collection, id, data)` | Create/overwrite document |
| `getDocument(collection, id)` | Get single document |
| `getDocuments(collection, constraints[])` | Query with filters |
| `updateDocument(collection, id, data)` | Partial update (auto-sets updatedAt) |
| `deleteDocument(collection, id)` | Delete document |
| `documentListener(collection, id)` | Real-time single doc listener |
| `collectionListener(collection, constraints[])` | Real-time collection listener |
| `appendToArrayField(collection, id, field, values)` | arrayUnion |
| `removeFromArrayField(collection, id, field, values)` | arrayRemove |
| `incrementCounter(collection, id, field)` | Atomic increment via runTransaction |
| `getQueryHelpers()` | Returns `{ where, orderBy, limit, startAfter }` |

### order.service.ts
| Method | Description |
|--------|-------------|
| `createOrder(data, createdBy)` | Create order with sequential number, returns orderId |
| `getOrder(orderId)` | Get single order |
| `updateOrder(orderId, data)` | Partial update |
| `updateOrderStatus(orderId, status, by, email, notes)` | Validates transition via `isValidStatusTransition()`, then updates status + timeline (arrayUnion). Throws if transition is invalid. |
| `getOrdersByCustomer(customerId)` | Query by customer |
| `getAllOrders()` | All orders (admin) |
| `orderListener(orderId)` | Real-time single order |
| `customerOrdersListener(customerId)` | Real-time customer orders |
| `allOrdersListener()` | Real-time all orders |
| `addMessage(orderId, senderId, email, role, msg, attachments)` | Add message to sub-collection |
| `getOrderMessages(orderId)` | Get all messages |
| `orderMessagesListener(orderId)` | Real-time messages |
| `deleteOrder(orderId, cancelledBy?, cancelledByEmail?)` | Cancel + soft delete: sets `status: 'cancelled'`, adds timeline entry, sets `isDeleted: true` + `deletedAt` |

### email-notification.service.ts
| Method | Description |
|--------|-------------|
| `sendNewOrderNotification(params)` | Sends admin email via EmailJS. Returns `Promise<{ success, error? }>`. Non-blocking — order completes even if email fails. |

### order.constants.ts (shared constants)
| Export | Description |
|--------|-------------|
| `COMPLETED_STATUSES` | Set of statuses for "Completed" tab filter |
| `CANCELLED_STATUSES` | Set of statuses for "Cancelled" tab filter |
| `STATUS_LABELS` | Human-readable labels for all statuses |
| `STATUS_CLASSES` | CSS class names for all statuses |
| `isValidStatusTransition(from, to)` | Returns boolean — checks if transition is allowed |
| `getAllowedNextStatuses(status)` | Returns array of valid next statuses |

### pricing.service.ts
| Method | Description |
|--------|-------------|
| `loadPricing()` | Fetch prices from Firestore `system/order` (called on login) |
| `isLoaded()` | Check if prices have been fetched |
| `getStructureCategories()` | All structure categories (hardcoded) |
| `getStructureCategory(id)` | Single category by ID |
| `getPricingByCategory(id)` | Merged pricing: hardcoded defs + Firestore prices. Items with missing prices are excluded (not defaulted to $0). |
| `getCategoryDisplayName(id)` | Category display name |

### storage.service.ts
| Method | Description |
|--------|-------------|
| `uploadFile(file, folder, userId, orderId)` | Upload single file, returns URL |
| `uploadMultipleFiles(files, folder, userId, orderId)` | Upload batch, returns URLs |
| `uploadFileWithProgress(file, folder, userId, orderId)` | Observable with progress % |
| `deleteFileByUrl(url)` | Delete file from Storage |
| `listOrderFiles(orderId, folder)` | List files in order folder |

---

## Build & Deploy

```bash
cd "d:/New folder/roofrix-site"
rm -rf dist && npm run build
rm -rf public && mkdir public && cp -r dist/roofrix-site/browser/* public/
firebase deploy --only hosting
```

---

## Environment Config

```typescript
export const environment = {
  production: false,
  googleMapsApiKey: '...',
  firebase: {
    apiKey: '...',
    authDomain: 'roofrix-d116a.firebaseapp.com',
    projectId: 'roofrix-d116a',
    storageBucket: 'roofrix-d116a.firebasestorage.app',
    messagingSenderId: '...',
    appId: '...',
    measurementId: '...',
  },
};
```
