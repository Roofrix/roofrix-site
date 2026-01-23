# Roofrix - Residential Roof Report Platform

A modern web application for ordering residential roof reports, built with Angular 21 and Firebase.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Database Structure](#database-structure)
- [Authentication & Authorization](#authentication--authorization)
- [Setup & Installation](#setup--installation)
- [Firebase Configuration](#firebase-configuration)
- [Available Scripts](#available-scripts)

---

## Overview

Roofrix is a roof report ordering platform that allows customers to order various types of roof reports with optional addons. The platform supports three user roles: Admin, Customer, and Designer.

### User Roles

| Role | Description |
|------|-------------|
| **Admin** | Manages all orders, assigns designers, updates pricing, views all system data |
| **Customer** | Creates orders, views their order history, tracks order status |
| **Designer** | Works on assigned orders, uploads design files |

---

## Tech Stack

- **Frontend**: Angular 21 (Standalone Components)
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Styling**: SCSS with CSS Variables
- **State Management**: RxJS Observables
- **Build Tool**: Angular CLI with esbuild

---

## Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── guards/
│   │   │   ├── auth.guard.ts         # Authentication guard
│   │   │   └── role.guard.ts         # Role-based access guard
│   │   ├── services/
│   │   │   ├── auth.service.ts       # Firebase Authentication
│   │   │   ├── firestore.service.ts  # Firestore operations
│   │   │   ├── order.service.ts      # Order management
│   │   │   ├── pricing.service.ts    # Pricing data management
│   │   │   └── user.service.ts       # User profile management
│   │   └── utils/
│   │       └── validators.ts         # Firebase error messages
│   │
│   ├── layouts/
│   │   ├── dashboard-layout/         # Dashboard layout (authenticated users)
│   │   └── public-layout/            # Public pages layout
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── signin/               # Sign in page
│   │   │   └── signup/               # Sign up page
│   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   │   └── orders/           # Admin orders management
│   │   │   ├── customer/
│   │   │   │   ├── new-order/        # Create new order
│   │   │   │   └── orders/           # Customer order history
│   │   │   └── designer/
│   │   │       └── orders/           # Designer assigned orders
│   │   ├── home/                     # Home page
│   │   ├── about/                    # About page
│   │   ├── contact/                  # Contact page
│   │   ├── features/                 # Features page
│   │   └── pricing/                  # Pricing page
│   │
│   └── shared/
│       ├── navbar/                   # Navigation bar
│       └── footer/                   # Footer component
│
├── assets/                           # Static assets
├── environments/                     # Environment configurations
└── styles.scss                       # Global styles
```

---

## Features

### Order Form
- **Address Entry**: Property address input
- **Report Type Selection**: Choose from multiple report types (fetched from database)
- **Addons**: Optional addons with individual pricing
- **Structure Type**: Main or Main and Garage
- **Roof Pitch**: Primary and secondary pitch specification
- **Special Instructions**: Notes and access details
- **File Upload**: Upload photos (JPG, PNG, PDF)

### Order Management
- **Real-time Updates**: Orders update in real-time via Firestore listeners
- **Status Tracking**: Full status timeline with change history
- **Designer Assignment**: Admin can assign designers to orders
- **Priority System**: Rush orders automatically set to high priority

### Admin Features
- **View All Orders**: See all orders with search and filter
- **Update Order Status**: Change status with notes
- **Assign Designers**: Assign orders to available designers
- **Manage Pricing**: Update report types and addon prices

---

## Database Structure

### Firestore Collections

#### 1. `users` Collection
Stores user profiles and role information.

```typescript
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'customer' | 'designer';
  phone?: string;
  company?: string;
  assignedOrders?: string[];  // For designers
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 2. `reportTypes` Collection
Stores available report types with pricing (managed by admin).

```typescript
interface ReportType {
  id: string;
  name: string;              // e.g., "Standard Roof Report"
  description: string;       // e.g., "ESX only", "XML only"
  price: number;             // e.g., 14, 18
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Default Report Types:**
| ID | Name | Description | Price |
|----|------|-------------|-------|
| report_type_1 | Standard Roof Report | ESX only | $14 |
| report_type_2 | Complex Roof Report | ESX only | $18 |
| report_type_3 | Standard Roof Report | XML only | $14 |
| report_type_4 | Complex Roof Report | XML only | $18 |

#### 3. `addons` Collection
Stores available addons with pricing (managed by admin).

```typescript
interface Addon {
  id: string;
  name: string;              // e.g., "PDF", "Fence", "Deck"
  price: number;             // e.g., 5, 10
  badge?: string;            // e.g., "FAST" for rush orders
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Default Addons:**
| ID | Name | Price | Badge |
|----|------|-------|-------|
| addon_1 | PDF | $5 | - |
| addon_2 | Fence | $5 | - |
| addon_3 | Deck | $5 | - |
| addon_4 | Make it 2hr Rush | $10 | FAST |

#### 4. `structureTypes` Collection
Stores available structure types.

```typescript
interface StructureType {
  id: string;
  name: string;              // e.g., "Main", "Main and Garage"
  isActive: boolean;
  sortOrder: number;
}
```

#### 5. `orders` Collection
Stores all customer orders with pricing snapshots.

```typescript
interface Order {
  id: string;
  orderNumber: string;       // e.g., "ORD-2026-123456"

  // Customer Info
  customerId: string;
  customerEmail: string;
  customerName: string;

  // Assigned Designer
  assignedDesignerId?: string;
  assignedDesignerEmail?: string;

  // Order Details
  projectAddress: string;

  // Report Type (snapshot with price at time of order)
  reportType: {
    id: string;
    name: string;
    description: string;
    price: number;
  };

  // Addons (snapshot with prices at time of order)
  addons: Array<{
    id: string;
    name: string;
    price: number;
  }>;

  // Structure and Pitch
  structureType: string;
  primaryPitch?: string;
  secondaryPitch?: string;

  // Special Instructions
  specialInstructions?: string;

  // Pricing (calculated at time of order)
  basePrice: number;         // Report type price
  addonsTotal: number;       // Sum of addon prices
  totalPrice: number;        // basePrice + addonsTotal

  // Status
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';

  // Status Timeline
  statusTimeline: Array<{
    status: OrderStatus;
    changedAt: Timestamp;
    changedBy: string;
    changedByEmail: string;
    changedByRole: 'admin' | 'customer' | 'designer' | 'system';
    notes?: string;
  }>;

  // Files
  siteImages: string[];      // Customer uploaded images
  designFiles: string[];     // Designer uploaded files

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;

  // Priority
  priority: 'low' | 'medium' | 'high';
}
```

#### 6. `orders/{orderId}/messages` Subcollection
Stores messages/communication for each order.

```typescript
interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderEmail: string;
  senderRole: 'admin' | 'customer' | 'designer';
  message: string;
  attachments?: string[];
  createdAt: Timestamp;
  isRead: boolean;
  readBy: string[];
}
```

### Database Diagram

```
Firestore Database
│
├── users/
│   └── {userId}
│       ├── email
│       ├── displayName
│       ├── role
│       └── ...
│
├── reportTypes/
│   └── {reportTypeId}
│       ├── name
│       ├── description
│       ├── price
│       └── isActive
│
├── addons/
│   └── {addonId}
│       ├── name
│       ├── price
│       ├── badge
│       └── isActive
│
├── structureTypes/
│   └── {structureTypeId}
│       ├── name
│       └── isActive
│
└── orders/
    └── {orderId}
        ├── orderNumber
        ├── customerId
        ├── reportType (embedded object)
        ├── addons (array of objects)
        ├── status
        ├── statusTimeline (array)
        ├── totalPrice
        └── messages/ (subcollection)
            └── {messageId}
                ├── message
                ├── senderId
                └── createdAt
```

---

## Authentication & Authorization

### Firebase Authentication
- Email/Password authentication
- Session persistence across browser refresh

### Route Guards

**AuthGuard** (`auth.guard.ts`):
- Protects routes requiring authentication
- Redirects to signin if not authenticated
- Waits for auth loading state before checking

**RoleGuard** (`role.guard.ts`):
- Protects role-specific routes
- Checks user role from Firestore profile
- Redirects unauthorized users

### Protected Routes

| Route | Required Role |
|-------|---------------|
| `/dashboard/admin/*` | admin |
| `/dashboard/customer/*` | customer |
| `/dashboard/designer/*` | designer |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+
- Angular CLI 21+
- Firebase project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd roofrix-site
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password)
   - Create Firestore database
   - Copy your Firebase config to `src/environments/environment.ts`

4. **Initialize Pricing Data**
   - Call `pricingService.initializeDefaultPricing()` once to seed the database
   - This creates default report types, addons, and structure types

5. **Run the development server**
   ```bash
   npm start
   ```

---

## Firebase Configuration

### environment.ts

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  }
};
```

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Pricing collections (read by all authenticated, write by admin)
    match /reportTypes/{docId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /addons/{docId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /structureTypes/{docId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Orders collection
    match /orders/{orderId} {
      allow read: if request.auth != null && (
        resource.data.customerId == request.auth.uid ||
        resource.data.assignedDesignerId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth != null;
      allow update: if request.auth != null;

      // Messages subcollection
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server on http://localhost:4200 |
| `npm run build` | Build for production |
| `npm run watch` | Build with watch mode |
| `npm test` | Run unit tests with Vitest |
| `ng generate component <name>` | Generate a new component |

---

## Order Status Flow

```
┌──────────┐    ┌─────────────┐    ┌────────┐    ┌───────────┐
│ pending  │ -> │ in_progress │ -> │ review │ -> │ completed │
└──────────┘    └─────────────┘    └────────┘    └───────────┘
      │                                                │
      └────────────────────────────────────────────────┘
                         cancelled
```

### Status Descriptions

| Status | Description |
|--------|-------------|
| `pending` | Order created, waiting for admin to assign |
| `in_progress` | Designer is working on the order |
| `review` | Design complete, under review |
| `completed` | Order completed and delivered |
| `cancelled` | Order cancelled |

---

## Price Snapshot System

When an order is created, the current prices are captured and stored with the order. This ensures:

1. **Historical Accuracy**: If prices change later, old orders reflect original prices
2. **Audit Trail**: Can see exactly what customer paid at time of order
3. **No Price Drift**: Order totals remain consistent

Example:
```typescript
// Price snapshot stored with order
order.reportType = {
  id: "report_type_2",
  name: "Complex Roof Report",
  description: "ESX only",
  price: 18  // Price at time of order
};

order.addons = [
  { id: "addon_1", name: "PDF", price: 5 },
  { id: "addon_4", name: "Make it 2hr Rush", price: 10 }
];

order.basePrice = 18;      // Report type price
order.addonsTotal = 15;    // 5 + 10
order.totalPrice = 33;     // 18 + 15
```

---

## Status Timeline

Every status change is recorded in the `statusTimeline` array:

```typescript
statusTimeline: [
  {
    status: "pending",
    changedAt: Timestamp,
    changedBy: "user_uid",
    changedByEmail: "customer@email.com",
    changedByRole: "customer",
    notes: "Order created"
  },
  {
    status: "pending",
    changedAt: Timestamp,
    changedBy: "admin_uid",
    changedByEmail: "admin@email.com",
    changedByRole: "admin",
    notes: "Assigned to designer: designer@email.com"
  },
  {
    status: "in_progress",
    changedAt: Timestamp,
    changedBy: "admin_uid",
    changedByEmail: "admin@email.com",
    changedByRole: "admin",
    notes: "Started work"
  }
]
```

---

## Initializing Default Data

To seed the database with default pricing data, you need to call the `initializeDefaultPricing()` method once. You can do this by:

1. **From browser console** (when logged in as admin):
   ```javascript
   // In browser dev tools
   const pricingService = // get service instance
   pricingService.initializeDefaultPricing();
   ```

2. **From a temporary admin page or component**:
   ```typescript
   // In any component
   constructor(private pricingService: PricingService) {}

   async initData() {
     await this.pricingService.initializeDefaultPricing();
     console.log('Pricing data initialized!');
   }
   ```

3. **Via Firebase Console**:
   Manually add documents to `reportTypes`, `addons`, and `structureTypes` collections.

---

## Key Services

### AuthService (`auth.service.ts`)
- `signIn(email, password)` - Sign in user
- `signUp(email, password, profile)` - Create new user
- `signOut()` - Sign out user
- `currentUser$` - Observable of current user
- `isAuthenticated$` - Observable of auth state
- `loading$` - Observable of loading state

### OrderService (`order.service.ts`)
- `createOrder(data, userId)` - Create new order
- `getOrder(orderId)` - Get single order
- `updateOrderStatus(...)` - Update order status with timeline
- `assignDesigner(...)` - Assign designer to order
- `allOrdersListener(limit)` - Real-time listener for all orders
- `customerOrdersListener(customerId)` - Real-time listener for customer orders

### PricingService (`pricing.service.ts`)
- `getReportTypes()` - Get active report types
- `getAddons()` - Get active addons
- `getStructureTypes()` - Get active structure types
- `initializeDefaultPricing()` - Seed default pricing data
- `updateReportTypePrice(id, price)` - Update report type price
- `updateAddonPrice(id, price)` - Update addon price

---

## License

This project is proprietary and confidential.
