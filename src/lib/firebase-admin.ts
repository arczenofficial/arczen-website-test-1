/**
 * Firebase Admin SDK — Server-side only
 * ─────────────────────────────────────
 * This file ONLY runs on the server (Astro SSR / Netlify Functions).
 * It is NEVER sent to the browser.
 *
 * Uses the private service account key which has unrestricted database access.
 * All requests from here bypass Firestore Security Rules (trusted server context).
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp(): App {
    if (getApps().length > 0) return getApps()[0];

    const projectId = import.meta.env.FIREBASE_PROJECT_ID;
    const clientEmail = import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let pk = import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

    if (!projectId || !clientEmail || !pk) {
        console.error('❌ [FirebaseAdmin] Missing environment variables:', { 
            hasProjectId: !!projectId, 
            hasClientEmail: !!clientEmail, 
            hasPrivateKey: !!pk 
        });
    }

    // Strip accidental surrounding quotes from .env strings
    if (pk.startsWith('"') && pk.endsWith('"')) pk = pk.slice(1, -1);
    if (pk.startsWith("'") && pk.endsWith("'")) pk = pk.slice(1, -1);
    
    // Netlify and some local envs store the key as a string with literal \n — convert back
    pk = pk.replace(/\\n/g, '\n');

    try {
        console.log(`📡 [FirebaseAdmin] Initializing for project: ${projectId}`);
        return initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: pk,
            }),
        });
    } catch (error: any) {
        console.error('❌ [FirebaseAdmin] Initialization Failed:', error.message);
        throw error;
    }
}

export const adminDb = getFirestore(getAdminApp());
export const adminAuth = getAuth(getAdminApp());
