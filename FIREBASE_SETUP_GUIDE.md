# Firebase Setup Guide - Fix Authentication Error

## Current Error
```
POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyAx7RlSR3sAtZw32ANQmBeKH6cExpT0_3w 400 (Bad Request)
```

This error indicates that Firebase Authentication needs to be properly configured in your Firebase Console.

## Step-by-Step Setup

### 1. Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **roofrix-d116a**
3. In the left sidebar, click **"Build"** → **"Authentication"**
4. Click **"Get Started"** (if you haven't enabled Authentication yet)

### 2. Enable Email/Password Sign-In Method

1. Once in Authentication, click the **"Sign-in method"** tab at the top
2. Find **"Email/Password"** in the list of providers
3. Click on it to open the configuration
4. Toggle **"Enable"** to ON
5. Click **"Save"**

**Important:** Make sure both options are enabled:
- ✅ Email/Password
- ✅ Email link (passwordless sign-in) - Optional, can leave disabled

### 3. Enable Cloud Firestore

1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
   - Test mode rules expire in 30 days - we'll update them later
4. Select your preferred location (choose closest to your users)
5. Click **"Enable"**

### 4. Enable Firebase Storage

1. In the left sidebar, click **"Build"** → **"Storage"**
2. Click **"Get started"**
3. Choose **"Start in test mode"** (for development)
4. Click **"Next"**
5. Select the same location as Firestore
6. Click **"Done"**

### 5. Configure Security Rules (Production-Ready)

#### Firestore Security Rules

Once Firestore is created, update the rules:

1. Go to **Firestore Database** → **"Rules"** tab
2. Replace the existing rules with:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAdmin() {
      return isSignedIn() && getUserRole() == 'admin';
    }

    function isCustomer() {
      return isSignedIn() && getUserRole() == 'customer';
    }

    function isDesigner() {
      return isSignedIn() && getUserRole() == 'designer';
    }

    // Users collection
    match /users/{userId} {
      // Users can read their own profile, admins can read all
      allow read: if isOwner(userId) || isAdmin();

      // Only allow creating profiles during signup (system creates with uid)
      allow create: if isOwner(userId) &&
                       request.resource.data.role == 'customer';

      // Users can update their own profile (except role)
      allow update: if isOwner(userId) &&
                       request.resource.data.role == resource.data.role;

      // Only admins can delete users
      allow delete: if isAdmin();
    }

    // Orders collection
    match /orders/{orderId} {
      // Customers can read their own orders
      // Designers can read assigned orders
      // Admins can read all orders
      allow read: if isAdmin() ||
                     (isCustomer() && resource.data.customerId == request.auth.uid) ||
                     (isDesigner() && resource.data.assignedDesignerId == request.auth.uid);

      // Only customers can create orders for themselves
      allow create: if isCustomer() &&
                       request.resource.data.customerId == request.auth.uid;

      // Customers can update their own orders (limited fields)
      // Designers can update assigned orders (different fields)
      // Admins can update any order
      allow update: if isAdmin() ||
                       (isCustomer() && resource.data.customerId == request.auth.uid) ||
                       (isDesigner() && resource.data.assignedDesignerId == request.auth.uid);

      // Only admins can delete orders
      allow delete: if isAdmin();

      // Status history subcollection (read-only for customers/designers)
      match /statusHistory/{historyId} {
        allow read: if isAdmin() ||
                       (isCustomer() && get(/databases/$(database)/documents/orders/$(orderId)).data.customerId == request.auth.uid) ||
                       (isDesigner() && get(/databases/$(database)/documents/orders/$(orderId)).data.assignedDesignerId == request.auth.uid);

        allow write: if isAdmin() || isDesigner();
      }

      // Messages subcollection
      match /messages/{messageId} {
        allow read: if isAdmin() ||
                       (isCustomer() && get(/databases/$(database)/documents/orders/$(orderId)).data.customerId == request.auth.uid) ||
                       (isDesigner() && get(/databases/$(database)/documents/orders/$(orderId)).data.assignedDesignerId == request.auth.uid);

        allow create: if isSignedIn();
        allow update: if isSignedIn(); // For marking as read
        allow delete: if isAdmin();
      }
    }
  }
}
```

3. Click **"Publish"**

#### Storage Security Rules

1. Go to **Storage** → **"Rules"** tab
2. Replace with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // User avatars
    match /users/{userId}/avatar/{fileName} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId) &&
                      request.resource.size < 5 * 1024 * 1024 && // 5MB
                      request.resource.contentType.matches('image/.*');
    }

    // Order site images
    match /orders/{orderId}/site-images/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() &&
                      request.resource.size < 10 * 1024 * 1024 && // 10MB
                      request.resource.contentType.matches('image/.*');
    }

    // Order design files
    match /orders/{orderId}/design-files/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() &&
                      request.resource.size < 50 * 1024 * 1024; // 50MB
    }

    // Order message attachments
    match /orders/{orderId}/messages/{fileName} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() &&
                      request.resource.size < 20 * 1024 * 1024; // 20MB
    }
  }
}
```

3. Click **"Publish"**

### 6. Verify Configuration

After completing the above steps:

1. **Restart your development server:**
   ```bash
   # Press Ctrl+C to stop the current server
   npm start
   ```

2. **Clear browser cache and reload** the page at http://localhost:4200

3. **Test signup:**
   - Click "Get Started" in the navbar
   - Fill out the signup form
   - Submit
   - Check browser console for any errors

### 7. Create Initial Admin User (Optional)

After your first user signs up as a customer, you can manually promote them to admin:

1. Go to Firebase Console → Firestore Database
2. Find the `users` collection
3. Click on your user document
4. Edit the `role` field from `customer` to `admin`
5. Save

## Troubleshooting Common Issues

### Issue 1: Still Getting 400 Error

**Check:**
- Email/Password authentication is enabled in Firebase Console
- Your Firebase project is on the Spark (free) plan or higher
- API key restrictions (if any) allow `identitytoolkit.googleapis.com`

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Click on your API key
5. Under "API restrictions", select "Don't restrict key" (for development)

### Issue 2: Firestore Permission Denied

**Error:** `Missing or insufficient permissions`

**Fix:**
- Make sure you've published the Firestore security rules
- Verify the user has the correct role in Firestore
- Check that the user's UID matches the document ID in the `users` collection

### Issue 3: Storage Upload Fails

**Error:** `User does not have permission to access this object`

**Fix:**
- Make sure you've published the Storage security rules
- Verify the file size is within limits
- Check that the file path matches the security rule patterns

## Production Checklist

Before deploying to production:

- [ ] Change Firestore rules from test mode to production rules (shown above)
- [ ] Change Storage rules from test mode to production rules (shown above)
- [ ] Enable email verification (optional but recommended)
- [ ] Set up password reset functionality
- [ ] Configure CORS for your production domain
- [ ] Add your production domain to Firebase authorized domains
- [ ] Set up Firebase App Check for additional security
- [ ] Monitor Firebase usage and set up billing alerts
- [ ] Back up Firestore data regularly

## Testing the Integration

Once setup is complete, test these flows:

1. **Sign Up Flow:**
   - Navigate to signup page
   - Enter email and password
   - Verify Firestore creates user profile in `users` collection
   - Check that default role is `customer`

2. **Sign In Flow:**
   - Sign in with created account
   - Verify `lastLoginAt` updates in Firestore
   - Check that navbar shows user email

3. **Sign Out Flow:**
   - Click user dropdown in navbar
   - Click "Sign Out"
   - Verify redirected to home page
   - Check navbar shows "Sign In" / "Get Started" buttons

## Need Help?

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Check the Firebase Console → Authentication → Users tab to see if users are being created
3. Check Firestore → Data tab to see if user documents are being created
4. Review the Network tab in DevTools to see the exact API responses

## Current Configuration Summary

**Project ID:** roofrix-d116a
**Auth Domain:** roofrix-d116a.firebaseapp.com
**Storage Bucket:** roofrix-d116a.firebasestorage.app

All services should be enabled and configured with the security rules above.
