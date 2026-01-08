# Quick Firestore Fix - Enable Database

## Current Error
```
FirebaseError: Missing or insufficient permissions
```

This means Firestore needs to be enabled and configured with proper security rules.

## Fix in 3 Minutes

### Step 1: Enable Firestore Database (1 minute)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **roofrix-d116a**
3. Click **"Build"** in left sidebar → **"Firestore Database"**
4. Click **"Create database"** button
5. Select **"Start in test mode"** (for development)
   - ⚠️ Test mode allows all reads/writes for 30 days
   - We'll update to production rules later
6. Choose your location (closest to your users, e.g., us-central)
7. Click **"Enable"**

Wait for Firestore to be provisioned (~30 seconds).

### Step 2: Verify Test Mode Rules (30 seconds)

After Firestore is created:

1. Click the **"Rules"** tab at the top
2. You should see these test mode rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 2, 4);
    }
  }
}
```

3. If the date has already passed, click **"Edit rules"** and update the date to a future date (e.g., 30 days from now)
4. Click **"Publish"**

### Step 3: Test Signup Again (30 seconds)

1. **Refresh your browser** at http://localhost:4200
2. Click **"Get Started"**
3. Fill out the signup form:
   - Email: test@example.com
   - Password: Test1234
   - Confirm password: Test1234
   - Check terms box
4. Click **"Sign Up"**

**Expected Result:**
- User is created in Firebase Auth ✓ (already working)
- User profile is created in Firestore ✓ (will work after enabling Firestore)
- Redirect to home page with user email in navbar ✓

### Step 4: Verify in Firebase Console

After successful signup:

1. Go to **Firestore Database** → **"Data"** tab
2. You should see a new collection: **`users`**
3. Click on it to see your user document with:
   - Document ID = your user's UID
   - Fields: email, role (customer), createdAt, lastLoginAt, etc.

## What If It Still Doesn't Work?

### Issue: Still getting permissions error

**Possible causes:**
1. Firestore rules expired (test mode has 30-day limit)
2. Browser cache needs clearing

**Fix:**
```bash
# Clear browser cache completely
# Chrome: Ctrl+Shift+Delete → Clear all cached images and files

# Then refresh the page: Ctrl+Shift+R (hard refresh)
```

### Issue: Firestore already enabled but still failing

Update rules to allow all access temporarily:

1. Go to Firestore → Rules tab
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // Temporarily allow all access
    }
  }
}
```

3. Click "Publish"
4. Try signup again

⚠️ **Important:** Never use `if true` in production! This is only for testing.

## Optional: Enable Firebase Storage (for file uploads later)

Since you have the Storage service ready, enable it now:

1. Click **"Build"** → **"Storage"**
2. Click **"Get started"**
3. Select **"Start in test mode"**
4. Choose same location as Firestore
5. Click **"Done"**

## Production-Ready Rules (Deploy Later)

Once everything is working in test mode, update to production rules from [FIREBASE_SETUP_GUIDE.md](FIREBASE_SETUP_GUIDE.md) which includes:
- Role-based access control (admin/customer/designer)
- Users can only read/write their own data
- Admins can manage all data
- Proper validation rules

## Quick Check: Is Firestore Enabled?

Visit: https://console.firebase.google.com/project/roofrix-d116a/firestore

- ✅ If you see the database interface → Firestore is enabled
- ❌ If you see "Get Started" button → Firestore is NOT enabled, follow Step 1

## Summary

**Before enabling Firestore:**
- ✅ Firebase Auth works (user created successfully)
- ❌ Firestore fails with "Missing or insufficient permissions"

**After enabling Firestore:**
- ✅ Firebase Auth works
- ✅ Firestore profile creation works
- ✅ Full signup flow complete
- ✅ User can sign in/out
- ✅ Ready to build dashboards and features

**Time required:** 2-3 minutes total
