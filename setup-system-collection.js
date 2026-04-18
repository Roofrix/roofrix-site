/**
 * Creates system/order document with only id + price per item.
 * Names, descriptions, badges are hardcoded in pricing.service.ts.
 *
 * Usage: node setup-system-collection.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

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

const reportTypes = [
  { id: 'roof_esx_only', price: 14 },
  { id: 'roof_esx_pdf', price: 19 },
  { id: 'roof_xml_only', price: 14 },
  { id: 'roof_xml_pdf', price: 19 },
  { id: 'wall_esx_x1', price: 33 },
  { id: 'wall_esx_pdf_x1', price: 42 },
  { id: 'wall_esx_x2', price: 33 },
  { id: 'wall_esx_pdf_x2', price: 42 }
];

const systemOrder = {
  basic: {
    reportTypes,
    addons: [
      { id: 'basic_rush_2h', price: 5 },
      { id: 'basic_fence', price: 3 },
      { id: 'basic_deck', price: 3 }
    ]
  },
  moderate: {
    reportTypes,
    addons: [
      { id: 'moderate_rush_2h', price: 5 },
      { id: 'moderate_fence', price: 3 },
      { id: 'moderate_deck', price: 3 }
    ]
  },
  complex: {
    reportTypes,
    addons: [
      { id: 'complex_rush_2h', price: 5 },
      { id: 'complex_fence', price: 3 },
      { id: 'complex_deck', price: 3 }
    ]
  }
};

async function main() {
  console.log('Creating system/order document (id + price only)...\n');

  await setDoc(doc(db, 'system', 'order'), systemOrder);

  for (const [key, val] of Object.entries(systemOrder)) {
    console.log(`  ${key}: ${val.reportTypes.length} reportTypes, ${val.addons.length} addons`);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
