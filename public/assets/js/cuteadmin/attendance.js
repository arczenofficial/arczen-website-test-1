// Attendance Module - Core Firestore Logic
// Tracks login/logout sessions and computes attendance statistics
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

// ────────────────────────────────────────────
// Midnight Window Rule:
// If a user logs in between 11:30 PM and 12:30 AM (next day),
// the session counts as attendance for the PREVIOUS calendar day.
// This handles late-night logins gracefully.
// ────────────────────────────────────────────
const MIDNIGHT_WINDOW_START_HOUR = 23;   // 11 PM
const MIDNIGHT_WINDOW_START_MIN  = 30;   // :30
const MIDNIGHT_WINDOW_END_HOUR   = 0;    // Midnight
const MIDNIGHT_WINDOW_END_MIN    = 30;   // :30 AM

/**
 * Determines the "attendance date" for a login timestamp.
 * If login is between 11:30 PM–12:30 AM (next day), attribute to previous day.
 * Returns a YYYY-MM-DD string.
 */
export function getAttendanceDateForLogin(date) {
    const h = date.getHours();
    const m = date.getMinutes();

    const isLateNight = h === MIDNIGHT_WINDOW_START_HOUR && m >= MIDNIGHT_WINDOW_START_MIN;
    const isEarlyMorning = h === MIDNIGHT_WINDOW_END_HOUR && m <= MIDNIGHT_WINDOW_END_MIN;

    if (isEarlyMorning) {
        // 12:00 AM – 12:30 AM → attribute to yesterday
        const prev = new Date(date);
        prev.setDate(prev.getDate() - 1);
        return prev.toISOString().split('T')[0];
    }
    // 11:30 PM → still same calendar day (just mark it for today, window logic handled below)
    // For 11:30 PM the calendar day is already correct (prev day window closes at midnight)
    return date.toISOString().split('T')[0];
}

// ────────────────────────────────────────────
// Default schedule (can be overridden per-user via attendance_schedules)
// ────────────────────────────────────────────
export const DEFAULT_SCHEDULE = {
    workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    expectedLoginHour: 9,   // 9:00 AM BST (UTC+6)
    expectedLoginMin: 0,
    expectedLogoutHour: 18, // 6:00 PM BST (UTC+6)
    expectedLogoutMin: 0,
    lateThresholdMinutes: 10, // >10 min late = "partial" attendance (not absent)
    timezone: 'Asia/Dhaka'  // Bangladesh Standard Time
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ────────────────────────────────────────────
// Session Management
// ────────────────────────────────────────────

/**
 * Called when a user logs in — opens an attendance session.
 * Idempotent: if a session already exists for the attendance date, returns it.
 *
 * Special rule: logins between 11:30 PM–12:30 AM count as present for the PREVIOUS day.
 */
export async function openAttendanceSession(user) {
    try {
        const now = new Date();
        const attendanceDate = getAttendanceDateForLogin(now);
        const userId = user.uid;

        const h = now.getHours();
        const m = now.getMinutes();
        const isMidnightWindow =
            (h === MIDNIGHT_WINDOW_START_HOUR && m >= MIDNIGHT_WINDOW_START_MIN) ||
            (h === MIDNIGHT_WINDOW_END_HOUR && m <= MIDNIGHT_WINDOW_END_MIN);

        // Check if session already open for this attendance date
        const existingQ = query(
            collection(db, 'attendance_sessions'),
            where('userId', '==', userId),
            where('date', '==', attendanceDate),
            where('isActive', '==', true)
        );
        const existing = await getDocs(existingQ);
        if (!existing.empty) {
            console.log('[Attendance] Session already active for date:', attendanceDate);
            return existing.docs[0].id;
        }

        // Get schedule to determine work days and timing
        const schedule = await getUserSchedule(userId);

        // Use the attendance date's day-of-week (not necessarily today if midnight window)
        const attendanceDateObj = new Date(attendanceDate + 'T12:00:00');
        const dayName = DAY_NAMES[attendanceDateObj.getDay()];

        // Only track on scheduled work days
        if (!schedule.workDays.includes(dayName)) {
            console.log('[Attendance] Attendance date is not a work day:', dayName, attendanceDate);
            return null;
        }

        // Determine status: on-time, late, or midnight-window (auto-present for prev day)
        let status = 'present';
        let lateByMinutes = 0;

        if (isMidnightWindow) {
            // Midnight window login → counts as present for previous day regardless of time
            status = 'present';
            lateByMinutes = 0;
            console.log('[Attendance] Midnight window login, attributed to:', attendanceDate);
        } else {
            const expectedLogin = new Date(now);
            expectedLogin.setHours(schedule.expectedLoginHour, schedule.expectedLoginMin, 0, 0);
            lateByMinutes = Math.round((now - expectedLogin) / 60000);
            if (lateByMinutes > schedule.lateThresholdMinutes) {
                // > 10 min late = partial attendance (logged in late but still came)
                status = 'partial';
            }
        }

        const userProfile = window.CuteState?.userProfile || {};
        const docRef = await addDoc(collection(db, 'attendance_sessions'), {
            userId,
            userEmail: user.email,
            userName: userProfile.name || user.displayName || user.email,
            userPhoto: userProfile.photoUrl || user.photoURL || null,
            date: attendanceDate,
            loginTime: serverTimestamp(),
            logoutTime: null,
            duration: null,
            status,
            isActive: true,
            lateByMinutes: Math.max(0, lateByMinutes),
            isMidnightWindow,
            createdAt: serverTimestamp()
        });

        console.log('[Attendance] Session opened:', docRef.id, 'for:', attendanceDate, 'Status:', status);
        return docRef.id;

    } catch (error) {
        console.error('[Attendance] Failed to open session:', error);
        return null;
    }
}

/**
 * Called when a user logs out — closes the active session and calculates duration.
 */
export async function closeAttendanceSession(userId) {
    try {
        const today = getTodayDateString();

        const activeQ = query(
            collection(db, 'attendance_sessions'),
            where('userId', '==', userId),
            where('date', '==', today),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(activeQ);

        if (snapshot.empty) {
            console.log('[Attendance] No active session to close');
            return;
        }

        const sessionDoc = snapshot.docs[0];
        const sessionData = sessionDoc.data();

        // Calculate duration
        const loginTime = sessionData.loginTime?.toDate ? sessionData.loginTime.toDate() : new Date();
        const now = new Date();
        const durationMinutes = Math.round((now - loginTime) / 60000);

        await updateDoc(doc(db, 'attendance_sessions', sessionDoc.id), {
            logoutTime: serverTimestamp(),
            duration: durationMinutes,
            isActive: false
        });

        console.log('[Attendance] Session closed. Duration:', durationMinutes, 'minutes');
    } catch (error) {
        console.error('[Attendance] Failed to close session:', error);
    }
}

// ────────────────────────────────────────────
// Data Fetching
// ────────────────────────────────────────────

/**
 * Returns all attendance sessions for all users (admin view).
 */
export async function getAllAttendanceSessions(daysBack = 30) {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const q = query(
            collection(db, 'attendance_sessions'),
            where('date', '>=', cutoffStr),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('[Attendance] Failed to fetch all sessions:', error);
        return [];
    }
}

/**
 * Returns attendance sessions for a specific user.
 */
export async function getUserAttendanceSessions(userId, daysBack = 30) {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const q = query(
            collection(db, 'attendance_sessions'),
            where('userId', '==', userId),
            where('date', '>=', cutoffStr),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('[Attendance] Failed to fetch user sessions:', error);
        return [];
    }
}

/**
 * Gets or returns the default work schedule for a user.
 */
export async function getUserSchedule(userId) {
    try {
        const q = query(
            collection(db, 'attendance_schedules'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { ...DEFAULT_SCHEDULE, ...snapshot.docs[0].data() };
        }
    } catch (e) {
        console.warn('[Attendance] Could not load schedule, using default:', e);
    }
    return DEFAULT_SCHEDULE;
}

/**
 * Admin: Save custom schedule for a user.
 */
export async function saveUserSchedule(userId, scheduleData) {
    try {
        const q = query(
            collection(db, 'attendance_schedules'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            await addDoc(collection(db, 'attendance_schedules'), {
                userId,
                ...scheduleData,
                updatedAt: serverTimestamp()
            });
        } else {
            await updateDoc(doc(db, 'attendance_schedules', snapshot.docs[0].id), {
                ...scheduleData,
                updatedAt: serverTimestamp()
            });
        }
        return true;
    } catch (error) {
        console.error('[Attendance] Failed to save schedule:', error);
        return false;
    }
}

// ────────────────────────────────────────────
// Statistics Calculation
// ────────────────────────────────────────────

/**
 * Computes attendance statistics for a given set of sessions + schedule.
 * @param {Array} sessions - Array of session objects
 * @param {Object} schedule - Work schedule definition
 * @param {number} daysBack - How many calendar days to look back
 * @returns {Object} stats
 */
export function computeAttendanceStats(sessions, schedule, daysBack = 30) {
    const now = new Date();
    const workDaysInPeriod = [];

    for (let i = 0; i < daysBack; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        // Don't count today if session is still active
        const dayName = DAY_NAMES[d.getDay()];
        if (schedule.workDays.includes(dayName)) {
            workDaysInPeriod.push(d.toISOString().split('T')[0]);
        }
    }

    const totalWorkDays = workDaysInPeriod.length;
    const presentDays = sessions.filter(s => s.status === 'present').length;
    const partialDays = sessions.filter(s => s.status === 'partial').length;
    const absentDays = Math.max(0, totalWorkDays - sessions.length);

    // Both present and partial count as "attended" for the rate
    const attendedDays = presentDays + partialDays;
    const attendanceRate = totalWorkDays > 0
        ? Math.round((attendedDays / totalWorkDays) * 100)
        : 0;

    const avgDuration = sessions.length > 0
        ? Math.round(sessions
            .filter(s => s.duration)
            .reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.filter(s => s.duration).length)
        : 0;

    // Calculate streak (both present and partial count as attended)
    let currentStreak = 0;
    for (const dateStr of workDaysInPeriod) {
        const hasSession = sessions.some(s => s.date === dateStr);
        if (hasSession) {
            currentStreak++;
        } else {
            break;
        }
    }

    return {
        totalWorkDays,
        presentDays,
        partialDays,
        absentDays,
        attendedDays,
        attendanceRate,
        avgDurationMinutes: avgDuration,
        currentStreak,
        sessions
    };
}

/**
 * Builds a daily attendance map for a user list (admin overview).
 * Returns: { [userId]: { stats, sessions, user } }
 */
export async function buildTeamAttendanceReport(daysBack = 30) {
    try {
        const sessions = await getAllAttendanceSessions(daysBack);

        // Group by userId
        const byUser = {};
        for (const session of sessions) {
            if (!byUser[session.userId]) {
                byUser[session.userId] = {
                    userId: session.userId,
                    userName: session.userName,
                    userEmail: session.userEmail,
                    userPhoto: session.userPhoto,
                    sessions: []
                };
            }
            byUser[session.userId].sessions.push(session);
        }

        // Compute stats for each user
        for (const userId of Object.keys(byUser)) {
            const schedule = await getUserSchedule(userId);
            byUser[userId].stats = computeAttendanceStats(byUser[userId].sessions, schedule, daysBack);
        }

        return Object.values(byUser);
    } catch (error) {
        console.error('[Attendance] Failed to build team report:', error);
        return [];
    }
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

export function getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

export function formatDuration(minutes) {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

export function formatTime(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
