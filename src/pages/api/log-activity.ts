/**
 * POST /api/log-activity
 * ──────────────────────────────────────────────────────────────────────────
 * Server-side activity logger. The CLIENT sends their Firebase ID token +
 * an allowed event type + optional metadata. This server:
 *   1. Verifies the ID token (no fake UIDs possible)
 *   2. Enforces a strict allowlist of event types + metadata keys
 *   3. Writes to user_activity_logs/{uid}/events/{autoId} via Admin SDK
 * 
 * Firestore rules set user_activity_logs write = false for all clients,
 * so this is the ONLY way logs can be created. Users can never read their
 * own logs — only founders via the admin panel.
 */

import type { APIRoute } from 'astro';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { adminDb } from '../../lib/firebase-admin';

// ── Strict allowlist of event types ──────────────────────────────────────
const ALLOWED_TYPES = new Set([
    // Auth
    'login',
    'logout',
    'register',
    'password_changed',
    'password_reset_requested',
    'account_deleted',

    // Profile
    'profile_viewed',       // User viewed their own profile page
    'profile_updated',      // User saved changes to their profile

    // Navigation / Page
    'page_viewed',          // Generic page view (use pageId for specific pages)

    // Products
    'product_viewed',       // User viewed a product detail page
    'product_searched',     // User ran a search query

    // Cart & Wishlist
    'cart_added',
    'cart_removed',
    'wishlist_added',
    'wishlist_removed',

    // Orders
    'checkout_started',
    'checkout_completed',
    'order_placed',
    'order_viewed',         // User opened their order details

    // Settings / Account updates
    'settings_updated',     // Catch-all for any settings change with updatedFields
    'address_added',
    'address_updated',
    'address_deleted',
]);

// ── Strict allowlist of metadata keys (primitives only) ──────────────────
// Values are coerced to strings and capped at 256 chars — no nested objects.
const ALLOWED_META_KEYS = new Set([
    // Navigation
    'page',             // URL path, e.g. "/account/profile"
    'pageId',           // Slug or ID of the page, e.g. "checkout-step-2"
    'tab',              // Active tab within a page
    'referrer',         // Previous page URL

    // Products
    'productId',
    'productName',
    'productCategory',
    'searchQuery',      // What the user searched for

    // Orders
    'orderId',
    'orderStatus',      // Status at the time of the event
    'amount',
    'currency',

    // Profile / Settings updates
    'updatedFields',    // Comma-separated list of fields changed, e.g. "phone,address"
    'previousValue',    // Old value (scalar only, max 256 chars)
    'newValue',         // New value (scalar only, max 256 chars)

    // Auth
    'method',           // "email" | "google"
    'action',           // Freeform action label
]);

function parseBrowser(ua: string): string {
    if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    return 'Other';
}

function parseOS(ua: string): string {
    if (ua.includes('Windows NT')) return 'Windows';
    if (ua.includes('Mac OS X') && !ua.includes('iPhone') && !ua.includes('iPad')) return 'macOS';
    if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Other';
}

export const POST: APIRoute = async ({ request }) => {
    const headers = { 'Content-Type': 'application/json' };

    try {
        // ── Parse body ─────────────────────────────────────────────────────
        let body: any;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
        }

        const { token, type, metadata = {} } = body;

        if (!token || typeof token !== 'string') {
            return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers });
        }
        if (!type || !ALLOWED_TYPES.has(type)) {
            return new Response(JSON.stringify({ error: 'Invalid event type' }), { status: 400, headers });
        }

        // ── Verify the Firebase ID token ───────────────────────────────────
        let uid: string;
        let email: string | undefined;
        try {
            const adminApp = getApps()[0];
            if (!adminApp) throw new Error('Admin not initialized');
            const decoded = await getAuth(adminApp).verifyIdToken(token);
            uid = decoded.uid;
            email = decoded.email;
        } catch {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }

        // ── Sanitize metadata ──────────────────────────────────────────────
        const safeMetadata: Record<string, string | number | boolean> = {};
        for (const key of ALLOWED_META_KEYS) {
            const val = metadata[key];
            if (val !== undefined && val !== null && typeof val !== 'object' && typeof val !== 'function') {
                safeMetadata[key] = String(val).substring(0, 256); // max 256 chars per value
            }
        }

        // ── Parse User-Agent ───────────────────────────────────────────────
        const ua = request.headers.get('user-agent') || '';
        const browser = parseBrowser(ua);
        const os = parseOS(ua);

        // ── Write event document ───────────────────────────────────────────
        const eventsRef = adminDb
            .collection('user_activity_logs')
            .doc(uid)
            .collection('events');

        await eventsRef.add({
            uid,
            email: email || null,
            type,
            browser,
            os,
            timestamp: FieldValue.serverTimestamp(),
            ...safeMetadata,
        });

        // ── Update user summary (for fast stats queries) ───────────────────
        const summaryRef = adminDb.collection('user_activity_logs').doc(uid);
        const summaryUpdate: Record<string, any> = {
            lastActivity: FieldValue.serverTimestamp(),
            lastAction: type,
            email: email || null,
        };
        if (type === 'login')       summaryUpdate.lastLogin    = FieldValue.serverTimestamp();
        if (type === 'register')    summaryUpdate.firstSeen    = FieldValue.serverTimestamp();
        if (type === 'order_placed') summaryUpdate.totalOrders = FieldValue.increment(1);

        await summaryRef.set(summaryUpdate, { merge: true });

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

    } catch (err: any) {
        console.error('[log-activity] Internal error:', err?.message || err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
    }
};
