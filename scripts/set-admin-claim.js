/**
 * Utility tool to assign Firebase Custom Claims without using Cloud Functions.
 * 
 * Usage: 
 * 1. Download your Firebase Service Account JSON from:
 *    Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key
 * 2. Save it locally as `service-account.json`. (Make sure it is heavily gitignored).
 * 3. Run: `export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"`
 * 4. Run: `node public-site/scripts/set-admin-claim.js <USER_UID> true`
 */

import admin from 'firebase-admin';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the Firebase Admin SDK
async function initAdmin() {
    if (admin.apps.length) return;

    // 1. Try environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        return;
    }

    // 2. Try looking for service-account.json in common locations
    const possiblePaths = [
        path.join(process.cwd(), 'service-account.json'),
        path.join(__dirname, 'service-account.json'),
        path.join(__dirname, '../service-account.json')
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`ℹ️ Found service account at: ${p}`);
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8')))
            });
            return;
        }
    }

    console.error('❌ Error: No Firebase credentials found.');
    console.log('\nTo fix this:');
    console.log('1. Go to Firebase Console -> Project Settings -> Service Accounts');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save the JSON file as "service-account.json" in this folder.');
    process.exit(1);
}

await initAdmin();

const args = process.argv.slice(2);
const targetUid = args[0];
const makeAdmin = args[1] === 'true';

if (!targetUid) {
    console.error('❌ Error: Missing User UID parameter.');
    console.log('Usage: node set-admin-claim.js <USER_UID> <true|false>');
    process.exit(1);
}

async function setAdminClaim() {
    try {
        console.log(`Setting admin custom claim for UID: ${targetUid} to ${makeAdmin}...`);
        
        // This is the core Zero Trust mechanism: The JWT Custom Claim
        await admin.auth().setCustomUserClaims(targetUid, { admin: makeAdmin });
        
        console.log(`✅ Success! User ${targetUid} now has admin=${makeAdmin}.`);
        console.log(`The user must log out and log back in for the new token to apply.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to set custom claim:', error);
        process.exit(1);
    }
}

setAdminClaim();
