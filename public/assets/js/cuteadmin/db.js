import { getFirestore as getFirestoreSDK, doc as docSDK, getDoc as getDocSDK, collection as collectionSDK, addDoc as addDocSDK, serverTimestamp as serverTimestampSDK, updateDoc as updateDocSDK, query as querySDK, orderBy as orderBySDK, limit as limitSDK, getDocs as getDocsSDK, setDoc as setDocSDK, deleteDoc as deleteDocSDK } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth as getAuthSDK } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { firebaseConfig } from './config.js';

// Initialize Firebase app and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestoreSDK(app);
const auth = getAuthSDK(app);

export { app, db, auth };

// --- Data Utilities & Path Partitioning ---

export function getMonthName(monthIndex) {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return months[monthIndex];
}

export function getYearMonthPath(baseCollection, date = new Date()) {
    const year  = date.getFullYear();
    const month = getMonthName(date.getMonth());
    return `${baseCollection}/${year}/${month}`;
}

export function getYearMonthDayPath(baseCollection, date = new Date()) {
    const year  = date.getFullYear();
    const month = getMonthName(date.getMonth());
    const day   = date.getDate().toString().padStart(2, '0');
    return `${baseCollection}/${year}/${month}/${day}`;
}

// --- User & Role Management ---

export async function getUserAuthData(uid) {
    const userRef = docSDK(db, "users", uid);
    const docSnap = await getDocSDK(userRef);
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getAdminProfile(uid) {
    const adminRef = docSDK(db, "admins", uid);
    const docSnap = await getDocSDK(adminRef);
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getCustomerProfile(uid) {
    const profileRef = docSDK(db, "customers", uid);
    const docSnap = await getDocSDK(profileRef);
    return docSnap.exists() ? docSnap.data() : null;
}

export async function getRolePermissions(roleId) {
    const roleRef = docSDK(db, "roles", roleId);
    const docSnap = await getDocSDK(roleRef);
    return docSnap.exists() ? docSnap.data() : null;
}

// --- Masquerade Logic ---

export function getEffectiveRole() {
    const role = window.CuteState.role || 'guest';
    const viewMode = window.CuteState.viewMode;
    
    // Founders and Super Admins can masquerade as anything
    if (['super_admin', 'founder'].includes(role) && viewMode) {
        return viewMode;
    }
    return role;
}

export function canPerform(action) {
    const role = getEffectiveRole();

    const permissions = {
        'super_admin': ['view_all', 'delete_task', 'manage_users', 'view_logs', 'view_finance', 'edit_settings'],
        'founder': ['view_all', 'view_finance', 'view_orders'],
        'finance_admin': ['view_all', 'view_finance', 'manage_invoices'],
        'moderator': ['view_all', 'edit_task', 'view_orders'],
        'employee': ['view_assigned']
    };

    const allowed = permissions[role] || [];
    return allowed.includes(action);
}

// --- Logging System (The Double-Lock Audit) ---

/**
 * Public Activity Feed Log (Team-facing)
 * Now partitioned: activity_logs/{year}/{month}/{logId}
 */
export async function logAction(userId, actionType, details, taskId = null) {
    const timestamp = serverTimestampSDK();
    try {
        const userProfile = window.CuteState.userProfile || {};
        const userName = userProfile.name || (window.CuteState.user ? window.CuteState.user.displayName || window.CuteState.user.email : 'System');
        const userPhoto = userProfile.photoUrl || (window.CuteState.user ? window.CuteState.user.photoURL : null);

        const logPath = getYearMonthPath("activity_logs");

        const activityData = {
            userId: userId,
            userName: userName,
            userPhoto: userPhoto,
            userRole: userProfile.role || 'employee',
            action: actionType,
            details: details,
            timestamp: timestamp,
            relatedTaskId: taskId
        };

        await addDocSDK(collectionSDK(db, logPath), activityData);
    } catch (e) {
        console.error("[ActivityLogs] Failed to create log:", e);
    }

    // Task-Specific History
    if (taskId) {
        try {
            const historyRef = collectionSDK(db, "tasks", taskId, "history");
            await addDocSDK(historyRef, {
                userId: userId,
                action: actionType,
                details: details,
                timestamp: timestamp
            });
        } catch (e) {
            console.error("Task history log failed", e);
        }
    }
}

/**
 * Advanced System Audit (Admin-only)
 * Now partitioned: admin_logs/{year}/{month}/{logId}
 */
export async function logSystemAction(action, details, metadata = {}) {
    try {
        const user = window.CuteState.user;
        const logPath = getYearMonthPath("admin_logs");

        const auditData = {
            actorId: user ? user.uid : 'system',
            actorName: user ? (user.displayName || user.email) : 'System',
            actorRole: window.CuteState.role || 'guest',
            action: action,
            details: details,
            metadata: {
                ...metadata,
                viewMode: window.CuteState.viewMode || null,
                userAgent: navigator.userAgent
            },
            timestamp: serverTimestampSDK()
        };

        await addDocSDK(collectionSDK(db, logPath), auditData);
    } catch (e) {
        console.error("[AdminLogs] Failed to log security event:", e);
    }
}

export async function getGlobalLogs() {
    // Note: This only fetches logs for the CURRENT month due to partitioning.
    // For full history across partitions, a collectionGroup query OR multiple queries would be needed.
    const logPath = getYearMonthPath("activity_logs");
    const q = querySDK(collectionSDK(db, logPath), orderBySDK("timestamp", "desc"), limitSDK(50));
    const querySnapshot = await getDocsSDK(q);

    const logs = [];
    querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
    });
    return logs;
}

export async function getSystemAuditLogs() {
    if (window.CuteState.role !== 'admin') return [];

    const logPath = getYearMonthPath("admin_logs");
    const q = querySDK(collectionSDK(db, logPath), orderBySDK("timestamp", "desc"), limitSDK(100));
    const querySnapshot = await getDocsSDK(q);
    const logs = [];
    querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
    });
    return logs;
}

