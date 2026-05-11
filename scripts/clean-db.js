/**
 * Clean DB Script
 * - Deletes ALL orders from Firestore
 * - Deletes ALL files from Firebase Storage
 * - Resets orderNumber counter to 10000 (next order will be 10001)
 * - Keeps all user documents untouched
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
const bucket = admin.storage().bucket();

async function deleteAllOrders() {
  console.log('--- Deleting all orders ---');
  const ordersRef = db.collection('orders');
  const snapshot = await ordersRef.get();

  if (snapshot.empty) {
    console.log('No orders found.');
    return 0;
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

    // Delete order document
    await doc.ref.delete();
    count++;
    console.log(`  Deleted order ${doc.id}`);
  }

  console.log(`Deleted ${count} orders total.\n`);
  return count;
}

async function deleteAllStorage() {
  console.log('--- Deleting all files from Storage ---');
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
  await counterRef.set({ orderNumber: 10000 }, { merge: true });
  console.log('Order counter reset to 10000 (next order will be 10001).\n');
}

async function main() {
  console.log('=== Roofrix DB Cleanup ===\n');

  await deleteAllOrders();
  await deleteAllStorage();
  await resetOrderCounter();

  console.log('=== Cleanup complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
