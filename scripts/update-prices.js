const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: 'AIzaSyAx7RlSR3sAtZw32ANQmBeKH6cExpT0_3w',
  authDomain: 'roofrix-d116a.firebaseapp.com',
  projectId: 'roofrix-d116a',
  storageBucket: 'roofrix-d116a.firebasestorage.app',
  messagingSenderId: '221527874378',
  appId: '1:221527874378:web:44b5ae36ff78cf7b787fb3',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Price table: [basic, moderate, complex]
const priceTable = {
  roof_esx_only:   [14, 16, 18],
  roof_esx_pdf:    [20, 22, 24],
  roof_xml_only:   [14, 16, 18],
  roof_xml_pdf:    [20, 22, 24],
  wall_esx_x1:     [33, 36, 40],
  wall_esx_pdf_x1: [42, 46, 52],
  wall_esx_x2:     [33, 36, 40],
  wall_esx_pdf_x2: [42, 46, 52],
};

function buildReportTypes(categoryIndex) {
  return Object.entries(priceTable).map(([id, prices]) => ({
    id,
    price: prices[categoryIndex],
  }));
}

async function updatePrices() {
  const email = process.argv[2] || 'kiran@gmail.com';
  const password = process.argv[3];
  if (!password) {
    console.error('Usage: node scripts/update-prices.js <email> <password>');
    process.exit(1);
  }
  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Signed in successfully.');

  const data = {
    basic:    { reportTypes: buildReportTypes(0) },
    moderate: { reportTypes: buildReportTypes(1) },
    complex:  { reportTypes: buildReportTypes(2) },
  };

  console.log('Updating prices in system/order...');
  console.log(JSON.stringify(data, null, 2));

  await setDoc(doc(db, 'system', 'order'), data, { merge: true });
  console.log('Prices updated successfully!');
  process.exit(0);
}

updatePrices().catch((err) => {
  console.error('Failed to update prices:', err);
  process.exit(1);
});
