/**
 * Client-side Firebase initialization
 * ─────────────────────────────────────────────────────────────────────────────
 * This file runs in the BROWSER. It uses PUBLIC Firebase config (safe to expose).
 * Actual data access is controlled by Firestore Security Rules on Firebase's servers.
 *
 * Used for:
 *  - Customer auth (login, register, password reset)
 *  - Writing cart & wishlist data (authenticated users only)
 *
 * NOT used for: reading sensitive data (orders, customer profiles) — that
 * happens server-side via firebase-admin.ts which never reaches the browser.
 *
 * Activity logging is done via /api/log-activity (server-side, token-verified),
 * NEVER written directly to Firestore from the client.
 */

import { initializeApp, getApps }        from 'firebase/app';
import { getAuth, getIdToken }           from 'firebase/auth';
import { getFirestore }                   from 'firebase/firestore';

// These values are safe to be public — see README for explanation
const firebaseConfig = {
    apiKey:            import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain:        import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

let app: any = null;
let clientAuth: any = {
    onAuthStateChanged: (cb: any) => { if (typeof cb === 'function') cb(null); },
    currentUser: null,
    settings: {},
    languageCode: null,
    useDeviceLanguage: () => {}
};
let clientDb: any = {};

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20) {
        app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        clientAuth = getAuth(app);
        clientDb   = getFirestore(app);
    } else {
        console.warn('[Firebase] Public API Key missing or default. Running in unconfigured mode.');
    }
} catch (error) {
    console.error('[Firebase] Initialization error:', error);
}

const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.length > 20 && app);

/**
 * Log a user activity event via the secure server-side endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 * - Gets the current user's ID token (server verifies this)
 * - Sends to /api/log-activity which writes via Admin SDK
 * - NEVER writes to Firestore directly from the client
 * - Non-blocking (fire-and-forget) — failures are silently swallowed
 * - Only logs if a user is authenticated
 */
export async function logActivity(
    type: string,
    metadata: Record<string, string | number | boolean> = {}
): Promise<void> {
    try {
        const user = clientAuth.currentUser;
        if (!user || !user.getIdToken) return; // Not authenticated or stub auth

        const token = await getIdToken(user, false);

        // Fire and forget — don't block the main flow
        fetch('/api/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, type, metadata }),
        }).catch(() => {}); // Silently ignore network failures

    } catch {
        // Never throw — logging must never break the user flow
    }
}

export { clientAuth, clientDb, app as firebaseApp, isConfigured };
