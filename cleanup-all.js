/**
 * Full Firebase project reset: Firestore, Auth, and Storage.
 * Preserves the `system` collection (pricing data).
 *
 * Usage: node cleanup-all.js ./path-to-service-account-key.json [--force]
 *
 * Requires: npm install firebase-admin
 */

const admin = require('firebase-admin');
const readline = require('readline');

// --- CLI args ---
const serviceAccountPath = process.argv[2];
const forceMode = process.argv.includes('--force');

if (!serviceAccountPath || serviceAccountPath === '--force') {
  console.error('Usage: node cleanup-all.js <service-account-key.json> [--force]');
  console.error('\nGet your key from Firebase Console > Project Settings > Service Accounts > Generate New Private Key');
  process.exit(1);
}

// --- Init Admin SDK ---
const serviceAccount = require(require('path').resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'roofrix-d116a.firebasestorage.app',
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

// --- Helpers ---
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function batchProcess(items, fn, concurrency = 10) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

// --- Phase 1: Discovery ---
async function discover() {
  console.log('Scanning resources...\n');

  // Firestore
  const ordersSnap = await db.collection('orders').get();
  const usersSnap = await db.collection('users').get();

  let messageCount = 0;
  for (const orderDoc of ordersSnap.docs) {
    const msgsSnap = await db.collection('orders').doc(orderDoc.id).collection('messages').get();
    messageCount += msgsSnap.size;
  }

  // Auth users
  let authUserCount = 0;
  let nextPageToken;
  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    authUserCount += listResult.users.length;
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  // Storage files
  let storageFileCount = 0;
  try {
    const [files] = await bucket.getFiles();
    storageFileCount = files.length;
  } catch (err) {
    console.log(`  Warning: Could not list storage files: ${err.message}`);
  }

  console.log('  ┌─────────────────────────────────────┐');
  console.log('  │       RESOURCES TO DELETE            │');
  console.log('  ├─────────────────────────────────────┤');
  console.log(`  │  Orders:          ${String(ordersSnap.size).padStart(8)}        │`);
  console.log(`  │  Order Messages:  ${String(messageCount).padStart(8)}        │`);
  console.log(`  │  User Profiles:   ${String(usersSnap.size).padStart(8)}        │`);
  console.log(`  │  Auth Users:      ${String(authUserCount).padStart(8)}        │`);
  console.log(`  │  Storage Files:   ${String(storageFileCount).padStart(8)}        │`);
  console.log('  ├─────────────────────────────────────┤');
  console.log('  │  system/order:       KEEP           │');
  console.log('  │  system/counters:    RESET to 1000  │');
  console.log('  └─────────────────────────────────────┘');

  return { ordersSnap, usersSnap, authUserCount, storageFileCount };
}

// --- Phase 3: Delete Firestore ---
async function deleteFirestoreData(ordersSnap, usersSnap) {
  console.log('\n[1/3] Deleting Firestore data...');

  // Delete orders + messages subcollections
  for (const orderDoc of ordersSnap.docs) {
    const orderId = orderDoc.id;
    const orderNumber = orderDoc.data().orderNumber || orderId;

    // Delete messages subcollection
    const msgsSnap = await db.collection('orders').doc(orderId).collection('messages').get();
    for (const msgDoc of msgsSnap.docs) {
      await msgDoc.ref.delete();
    }
    if (msgsSnap.size > 0) {
      console.log(`  Deleted ${msgsSnap.size} messages from ${orderNumber}`);
    }

    // Delete order document
    await orderDoc.ref.delete();
    console.log(`  Deleted order: ${orderNumber}`);
  }

  // Delete user profiles
  for (const userDoc of usersSnap.docs) {
    const email = userDoc.data().email || userDoc.id;
    await userDoc.ref.delete();
    console.log(`  Deleted user profile: ${email}`);
  }

  // Reset order counter
  await db.doc('system/counters').set({ orderNumber: 1000 });
  console.log('  Reset order counter to 1000');

  console.log(`  Done: ${ordersSnap.size} orders, ${usersSnap.size} user profiles deleted.`);
}

// --- Phase 4: Delete Auth users ---
async function deleteAuthUsers() {
  console.log('\n[2/3] Deleting Auth users...');

  let totalDeleted = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    const uids = listResult.users.map((u) => u.uid);

    if (uids.length > 0) {
      const result = await auth.deleteUsers(uids);
      totalDeleted += result.successCount;
      if (result.failureCount > 0) {
        console.log(`  Warning: ${result.failureCount} users failed to delete`);
        for (const err of result.errors) {
          console.log(`    - ${err.error.message}`);
        }
      }
      console.log(`  Batch deleted ${result.successCount} auth users`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`  Done: ${totalDeleted} auth users deleted.`);
}

// --- Phase 5: Delete Storage files ---
async function deleteStorageFiles() {
  console.log('\n[3/3] Deleting Storage files...');

  let files;
  try {
    [files] = await bucket.getFiles();
  } catch (err) {
    console.log(`  Error listing files: ${err.message}`);
    return;
  }

  if (files.length === 0) {
    console.log('  No storage files found.');
    return;
  }

  let deleted = 0;
  let failed = 0;

  await batchProcess(files, async (file) => {
    try {
      await file.delete();
      deleted++;
    } catch (err) {
      failed++;
      console.log(`  Warning: Could not delete ${file.name}: ${err.message}`);
    }
  });

  console.log(`  Done: ${deleted} files deleted${failed > 0 ? `, ${failed} failed` : ''}.`);
}

// --- Main ---
async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   ROOFRIX - FULL PROJECT CLEANUP      ║');
  console.log('║   DB + Auth + Storage                 ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Phase 1: Discovery
  const { ordersSnap, usersSnap, authUserCount, storageFileCount } = await discover();

  const totalItems = ordersSnap.size + usersSnap.size + authUserCount + storageFileCount;
  if (totalItems === 0) {
    console.log('\nNothing to delete. Project is already clean.');
    process.exit(0);
  }

  // Phase 2: Confirmation
  if (!forceMode) {
    console.log('');
    const answer = await prompt('Type "DELETE ALL" to confirm full cleanup: ');
    if (answer !== 'DELETE ALL') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Phase 3-5: Delete everything
  await deleteFirestoreData(ordersSnap, usersSnap);
  await deleteAuthUsers();
  await deleteStorageFiles();

  // Phase 6: Summary
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   CLEANUP COMPLETE                    ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log('║   system/order:    PRESERVED          ║');
  console.log('║   system/counters: RESET TO 1000      ║');
  console.log('║   Everything else: DELETED            ║');
  console.log('╚═══════════════════════════════════════╝');

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
