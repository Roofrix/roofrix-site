/**
 * Clean DB Script
 * - Deletes ALL orders + messages from Firestore
 * - Deletes ALL files from Firebase Storage
 * - Resets orderNumber counter to 1000
 * - Deletes user profiles & Auth accounts NOT belonging to protected emails
 *
 * Protected emails (kept):
 *   sketch@roofrix.com, roofrix01@gmail.com, gemeka6398@donumart.com
 *
 * Usage: node scripts/clean-db.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'roofrix-d116a.firebasestorage.app',
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

const KEEP_EMAILS = [
  'sketch@roofrix.com',
  'roofrix01@gmail.com',
  'gemeka6398@donumart.com',
];

function isProtected(email) {
  return email && KEEP_EMAILS.includes(email.toLowerCase());
}

async function deleteAllOrders() {
  console.log('--- Deleting ALL orders ---');
  const ordersRef = db.collection('orders');
  const snapshot = await ordersRef.get();

  if (snapshot.empty) {
    console.log('No orders found.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    // Delete messages sub-collection first
    const messagesRef = ordersRef.doc(doc.id).collection('messages');
    const messagesSnap = await messagesRef.get();
    for (const msgDoc of messagesSnap.docs) {
      await msgDoc.ref.delete();
    }
    if (messagesSnap.size > 0) {
      console.log(`  Deleted ${messagesSnap.size} messages from order ${doc.id}`);
    }

    await doc.ref.delete();
    count++;
    console.log(`  Deleted order ${doc.id}`);
  }

  console.log(`Deleted ${count} orders total.\n`);
}

async function deleteAllStorage() {
  console.log('--- Deleting ALL files from Storage ---');
  try {
    const [files] = await bucket.getFiles();

    if (files.length === 0) {
      console.log('No files found in storage.');
      return;
    }

    for (const file of files) {
      await file.delete();
      console.log(`  Deleted: ${file.name}`);
    }

    console.log(`Deleted ${files.length} files total.\n`);
  } catch (error) {
    console.error('Error deleting storage files:', error.message);
  }
}

async function resetOrderCounter() {
  console.log('--- Resetting order counter ---');
  const counterRef = db.collection('system').doc('counters');
  await counterRef.set({ orderNumber: 1000 }, { merge: true });
  console.log('Order counter reset to 1000 (next order will be 1001).\n');
}

async function deleteUsers() {
  console.log('--- Deleting user profiles (skipping protected emails) ---');
  const usersSnap = await db.collection('users').get();

  let deleted = 0;
  let skipped = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (isProtected(data.email)) {
      skipped++;
      console.log(`  KEPT user profile: ${data.email}`);
      continue;
    }
    await doc.ref.delete();
    deleted++;
    console.log(`  Deleted user profile: ${data.email || doc.id}`);
  }

  console.log(`User profiles: ${deleted} deleted, ${skipped} kept.\n`);
}

async function deleteAuthUsers() {
  console.log('--- Deleting Auth users (skipping protected emails) ---');

  let deleted = 0;
  let skipped = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);

    for (const user of listResult.users) {
      if (isProtected(user.email)) {
        skipped++;
        console.log(`  KEPT auth user: ${user.email}`);
        continue;
      }
      await auth.deleteUser(user.uid);
      deleted++;
      console.log(`  Deleted auth user: ${user.email || user.uid}`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`Auth users: ${deleted} deleted, ${skipped} kept.\n`);
}

async function main() {
  console.log('=== Roofrix DB Cleanup ===');
  console.log(`Protected emails: ${KEEP_EMAILS.join(', ')}\n`);

  await deleteAllOrders();
  await deleteAllStorage();
  await resetOrderCounter();
  await deleteUsers();
  await deleteAuthUsers();

  console.log('=== Cleanup complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
