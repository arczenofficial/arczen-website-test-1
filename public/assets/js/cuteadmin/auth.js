import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from "./utils.js";
import { openAttendanceSession, closeAttendanceSession } from './attendance.js';
import { db } from "./db.js";

export function initAuth(app) {
    const auth = getAuth(app);
    return auth;
}

// Helper to get IP address
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        console.warn('Failed to get IP', e);
        return 'Unknown';
    }
}

// Google Sign-In
export async function loginWithGoogle(auth) {
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const user = userCredential.user;

        // SECURITY: Check if user is in whitelist (Firestore users collection)
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // User not in whitelist - REJECT and sign them out
            await signOut(auth);
            showToast("Access denied. Contact admin to be added to the team.", "error");
            throw new Error("User not authorized");
        }

        // Track activity
        try {
            const { updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const { logSystemAction } = await import('./db.js');
            const ip = await getUserIP();

            await updateDoc(userRef, {
                lastLogin: serverTimestamp(),
                lastLoginIP: ip,
                lastActiveAt: serverTimestamp(),
                isActive: true
            });

            // Log to System Audit
            await logSystemAction('user_login', `User ${user.email} logged in via Google`, { ip: ip, email: user.email, method: 'google' });
        } catch (err) {
            console.error("Failed to log activity:", err);
        }

        showToast("Welcome back!", "success");

        // Open attendance session (non-blocking)
        openAttendanceSession(user).catch(e => console.warn('[Auth] Attendance session error:', e));

        return user;
    } catch (error) {
        console.error("Google Login Error:", error);
        let msg = "Google sign-in failed.";
        if (error.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
        if (error.code === 'auth/unauthorized-domain') msg = "This domain is not authorized. Please contact admin.";
        if (error.message === 'User not authorized') msg = "Access denied. Your email is not registered.";

        // Log failed attempt
        try {
            const { logSystemAction } = await import('./db.js');
            const ip = await getUserIP();
            await logSystemAction('login_failed', `Failed Google login attempt`, { ip: ip, error: error.code || error.message, method: 'google' });
        } catch (e) { }

        showToast(msg, "error");
        throw error;
    }
}

export async function login(auth, email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Track activity
        try {
            const { doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const ip = await getUserIP();

            await updateDoc(doc(db, "users", user.uid), {
                lastLogin: serverTimestamp(),
                lastLoginIP: ip,
                lastActiveAt: serverTimestamp(),
                isActive: true
            });

            // Log to System Audit
            await logSystemAction('user_login', `User ${user.email} logged in`, { ip: ip, email: user.email });
        } catch (err) {
            console.error("Failed to log activity:", err);
        }

        showToast("Welcome back!", "success");

        // Open attendance session (non-blocking)
        openAttendanceSession(user).catch(e => console.warn('[Auth] Attendance session error:', e));

        return user;
    } catch (error) {
        console.error("Login Error:", error);
        let msg = "Login failed.";
        if (error.code === 'auth/invalid-credential') msg = "Invalid email or password.";
        if (error.code === 'auth/too-many-requests') msg = "Too many attempts. Try again later.";

        // Log failed attempt
        try {
            const { logSystemAction } = await import('./db.js');
            const ip = await getUserIP();
            await logSystemAction('login_failed', `Failed login attempt for ${email}`, { ip: ip, email: email, error: error.code });
        } catch (e) { }

        showToast(msg, "error");
        throw error;
    }
}

export async function logout(auth) {
    try {
        const user = auth.currentUser;
        if (user) {
            // Close attendance session before signing out
            await closeAttendanceSession(user.uid).catch(e => console.warn('[Auth] Attendance close error:', e));

            const { logSystemAction } = await import('./db.js');
            await logSystemAction('user_logout', `User ${user.email} logged out`, { email: user.email });
        }
        await signOut(auth);
        showToast("Logged out successfully", "neutral");
        window.location.hash = '#login';
    } catch (error) {
        console.error("Logout Error:", error);
        showToast("Error logging out", "error");
    }
}
