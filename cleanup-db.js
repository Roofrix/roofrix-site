/**
 * Delete all orders (documents + sub-collections) and their storage files.
 *
 * Usage: node cleanup-db.js
 *
 * Note: Storage security rules require authenticated access.
 *       You must sign in with an admin account to delete files.
 */

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
} = require('firebase/firestore');
const {
  getAuth,
  signInWithEmailAndPassword,
} = require('firebase/auth');
const {
  getStorage,
  ref,
  deleteObject,
} = require('firebase/storage');
const readline = require('readline');

const firebaseConfig = {
  apiKey: 'AIzaSyAx7RlSR3sAtZw32ANQmBeKH6cExpT0_3w',
  authDomain: 'roofrix-d116a.firebaseapp.com',
  projectId: 'roofrix-d116a',
  storageBucket: 'roofrix-d116a.firebasestorage.app',
  messagingSenderId: '221527874378',
  appId: '1:221527874378:web:44b5ae36ff78cf7b787fb3',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// Accept credentials via args: node cleanup-db.js email password
const argEmail = process.argv[2];
const argPassword = process.argv[3];

async function deleteMessages(orderId) {
  const messagesRef = collection(db, 'orders', orderId, 'messages');
  const snapshot = await getDocs(messagesRef);
  for (const msgDoc of snapshot.docs) {
    await deleteDoc(doc(db, 'orders', orderId, 'messages', msgDoc.id));
  }
  return snapshot.size;
}

function extractStoragePath(url) {
  try {
    // Firebase Storage URLs contain the path after /o/ and before ?
    const match = url.match(/\/o\/(.+?)\?/);
    if (match) return decodeURIComponent(match[1]);
  } catch {}
  return null;
}

async function deleteStorageFiles(siteImages) {
  let deleted = 0;
  for (const url of siteImages) {
    const path = extractStoragePath(url);
    if (!path) continue;
    try {
      await deleteObject(ref(storage, path));
      deleted++;
    } catch (err) {
      console.log(`    Warning: could not delete ${path}: ${err.message}`);
    }
  }
  return deleted;
}

async function main() {
  // Sign in to get storage access
  const email = argEmail || await prompt('Admin email: ');
  const password = argPassword || await prompt('Admin password: ');

  console.log('\nSigning in...');
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as: ${userCred.user.email}`);

  // Get all orders
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  console.log(`\nFound ${ordersSnapshot.size} orders to delete.`);

  if (ordersSnapshot.size === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  if (!argEmail) {
    const confirm = await prompt(`\nType "DELETE" to confirm deletion of all ${ordersSnapshot.size} orders: `);
    if (confirm !== 'DELETE') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log('\nDeleting...\n');

  for (const orderDoc of ordersSnapshot.docs) {
    const data = orderDoc.data();
    const orderId = orderDoc.id;
    const customerId = data.customerId;

    // 1. Delete messages sub-collection
    const msgCount = await deleteMessages(orderId);
    if (msgCount > 0) console.log(`  Deleted ${msgCount} messages from ${orderId}`);

    // 2. Delete storage files from items[].siteImages (supports both string URLs and {url,name} objects)
    const allUrls = [];
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.siteImages) {
          for (const img of item.siteImages) {
            allUrls.push(typeof img === 'string' ? img : img.url);
          }
        }
      }
    }
    // Also handle legacy outer siteImages
    if (data.siteImages && Array.isArray(data.siteImages)) {
      for (const img of data.siteImages) {
        allUrls.push(typeof img === 'string' ? img : img.url);
      }
    }
    const uniqueUrls = [...new Set(allUrls)];
    if (uniqueUrls.length > 0) {
      const fileCount = await deleteStorageFiles(uniqueUrls);
      if (fileCount > 0) console.log(`  Deleted ${fileCount} storage files for ${orderId}`);
    }

    // 3. Delete order document
    await deleteDoc(doc(db, 'orders', orderId));
    console.log(`  Deleted order: ${orderId} (${data.orderNumber || 'no number'})`);
  }

  // Reset order number counter
  const { setDoc } = require('firebase/firestore');
  await setDoc(doc(db, 'system', 'counters'), { orderNumber: 0 });
  console.log('\nReset order counter to 0');

  console.log(`\nDone! Deleted ${ordersSnapshot.size} orders.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
