/**
 * ArcZen Visitor Session Tracker
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks website visits and time-on-site WITHOUT requiring login.
 *
 * What it does:
 *  - Assigns each browser a persistent anonymous visitorId (localStorage)
 *  - Records page visit start time
 *  - Sends session data (duration, pages visited, last seen) to Firestore
 *  - Uses sendBeacon on page unload for reliability
 *  - If user is logged in (Firebase Auth), attaches their UID to the session
 *  - Sends heartbeats every 60s to mark "currently active"
 *
 * Admin can view:
 *  - Total unique visitors (today / week / month)
 *  - Sessions by logged-in users
 *  - Time on site per visitor
 *  - Whether a visitor has ever logged in
 *
 * Privacy: Anonymous ID is never shared externally. No cookies. Only localStorage.
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ─── Firebase config (public site — read from meta tags set by Astro) ─────────
const firebaseConfig = {
    apiKey:            document.querySelector('meta[name="fb-api-key"]')?.content,
    authDomain:        document.querySelector('meta[name="fb-auth-domain"]')?.content,
    projectId:         document.querySelector('meta[name="fb-project-id"]')?.content,
    storageBucket:     document.querySelector('meta[name="fb-storage-bucket"]')?.content,
    messagingSenderId: document.querySelector('meta[name="fb-messaging-sender-id"]')?.content,
    appId:             document.querySelector('meta[name="fb-app-id"]')?.content,
};

// Re-use existing Firebase app if already initialized (avoids duplicate app error)
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Visitor Identity ─────────────────────────────────────────────────────────
function getVisitorId() {
    let vid = localStorage.getItem('arczen_vid');
    if (!vid) {
        vid = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('arczen_vid', vid);
    }
    return vid;
}

// ─── Session State ────────────────────────────────────────────────────────────
const visitorId   = getVisitorId();
const sessionId   = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const startTime   = Date.now();
const startPage   = window.location.pathname;
const today       = new Date().toISOString().split('T')[0];

let   userId      = null;   // Set if logged-in user detected
let   heartbeatId = null;

// ─── Auth State Listener ──────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    userId = user ? user.uid : null;
    if (userId) {
        // Retroactively attach userId to existing session doc
        updateDoc(doc(db, 'visitor_sessions', sessionId), {
            userId,
            userEmail: user.email || null,
            isLoggedIn: true
        }).catch(() => {});
    }
});

// ─── Open Session ─────────────────────────────────────────────────────────────
async function openSession() {
    try {
        const ref = doc(db, 'visitor_sessions', sessionId);
        await setDoc(ref, {
            visitorId,
            sessionId,
            userId:     userId || null,
            userEmail:  null,
            isLoggedIn: !!userId,
            entryPage:  startPage,
            lastPage:   startPage,
            pagesVisited: 1,
            startedAt:  serverTimestamp(),
            lastSeenAt: serverTimestamp(),
            durationSeconds: 0,
            isActive:   true,
            date:       today,
            userAgent:  navigator.userAgent.slice(0, 150),     // Truncated for storage
            referrer:   document.referrer.slice(0, 100) || 'direct',
            language:   navigator.language || 'unknown',
        }, { merge: true });

        // Also update visitor-level aggregate
        await setDoc(doc(db, 'visitor_profiles', visitorId), {
            visitorId,
            lastSeen:   serverTimestamp(),
            lastPage:   startPage,
            totalVisits: increment(1),
            userId:     userId || null,
            isLoggedIn: !!userId,
            date:       today,
        }, { merge: true });

    } catch (e) {
        // Silently fail — never disrupt the user experience
        console.debug('[Tracker] Silent error opening session:', e?.code);
    }
}

// ─── Heartbeat (every 60s = "still on site") ─────────────────────────────────
function startHeartbeat() {
    heartbeatId = setInterval(async () => {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        try {
            await updateDoc(doc(db, 'visitor_sessions', sessionId), {
                lastSeenAt:      serverTimestamp(),
                lastPage:        window.location.pathname,
                durationSeconds,
                isActive:        true,
            });
        } catch (e) {
            console.debug('[Tracker] Heartbeat failed:', e?.code);
        }
    }, 60_000);
}

// ─── Close Session (page unload) ──────────────────────────────────────────────
function closeSession() {
    if (heartbeatId) clearInterval(heartbeatId);
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // sendBeacon is fire-and-forget, survives page close
    // We use a Firestore REST PATCH via sendBeacon workaround:
    // (sendBeacon can't do Firestore SDK calls, so we write to a queue collection)
    try {
        const payload = JSON.stringify({
            sessionId,
            visitorId,
            durationSeconds,
            lastPage: window.location.pathname,
            closedAt: new Date().toISOString(),
        });
        // Use a custom relay endpoint if available, otherwise skip
        const relayUrl = document.querySelector('meta[name="tracker-relay"]')?.content;
        if (relayUrl) {
            navigator.sendBeacon(relayUrl, payload);
        } else {
            // Fallback: best-effort sync write (may not complete)
            updateDoc(doc(db, 'visitor_sessions', sessionId), {
                isActive:        false,
                durationSeconds,
                lastPage:        window.location.pathname,
            }).catch(() => {});
        }
    } catch (e) {}
}

// ─── Page Navigation (for SPAs — call when route changes) ────────────────────
export function trackPageView(path) {
    try {
        updateDoc(doc(db, 'visitor_sessions', sessionId), {
            lastPage:     path || window.location.pathname,
            lastSeenAt:   serverTimestamp(),
            pagesVisited: increment(1),
        }).catch(() => {});
    } catch (e) {}
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
openSession();
startHeartbeat();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        closeSession();
    } else if (document.visibilityState === 'visible') {
        // Tab came back — update lastSeen
        updateDoc(doc(db, 'visitor_sessions', sessionId), {
            lastSeenAt: serverTimestamp(),
            isActive:   true,
        }).catch(() => {});
    }
});

window.addEventListener('pagehide', closeSession, { capture: true });
