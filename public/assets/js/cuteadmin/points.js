// Points / Rewards System - Core Logic
// Handles point awards, deductions, configuration, and statistics
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

// ────────────────────────────────────────────
// Default Config (stored in Firestore, admin-editable)
// ────────────────────────────────────────────
export const DEFAULT_POINTS_CONFIG = {
    // Task points
    taskBasePoints: 100,           // Base points for completing any task
    onTimeBonus: 25,               // Extra points if done before deadline
    earlyBonus: 15,                // Extra points if done 2+ days early
    lateDeductionPerDay: 10,       // Points deducted per day late (after deadline)
    negativeDeductionStart: 3,     // Days overdue before negative points kick in
    maxNegativePoints: -100,       // Floor for negative points per task

    // Priority multipliers
    highPriorityMultiplier: 1.5,
    mediumPriorityMultiplier: 1.0,
    lowPriorityMultiplier: 0.75,

    // Login streak bonuses
    loginStreak3Days: 10,          // Bonus every 3 consecutive days
    loginStreak7Days: 25,          // Bonus every 7 consecutive days
    loginStreak30Days: 100,        // Bonus every 30 consecutive days

    // Level thresholds (cumulative points)
    levelBronze: 0,
    levelSilver: 500,
    levelGold: 1500,
    levelPlatinum: 4000,

    updatedAt: null,
    updatedBy: null
};

// ────────────────────────────────────────────
// Config CRUD
// ────────────────────────────────────────────

export async function getPointsConfig() {
    try {
        const ref = doc(db, 'system_config', 'points_config');
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return { ...DEFAULT_POINTS_CONFIG, ...snap.data() };
        }
        return DEFAULT_POINTS_CONFIG;
    } catch (e) {
        console.warn('[Points] Could not load config, using defaults:', e);
        return DEFAULT_POINTS_CONFIG;
    }
}

export async function savePointsConfig(newConfig) {
    try {
        if (window.CuteState?.role !== 'admin') {
            throw new Error('Permission denied: only admins can change point rules');
        }
        const ref = doc(db, 'system_config', 'points_config');
        await setDoc(ref, {
            ...newConfig,
            updatedAt: serverTimestamp(),
            updatedBy: window.CuteState?.user?.uid || 'unknown'
        }, { merge: true });
        return true;
    } catch (e) {
        console.error('[Points] Failed to save config:', e);
        return false;
    }
}

// ────────────────────────────────────────────
// Points Calculation
// ────────────────────────────────────────────

/**
 * Calculate points for a completed task.
 * @param {Object} task - Task data object with deadline, priority, completedAt
 * @param {Object} config - Points config
 * @returns {{ points: number, breakdown: string[] }}
 */
export function calculateTaskPoints(task, config) {
    const cfg = config || DEFAULT_POINTS_CONFIG;
    const breakdown = [];

    // Priority multiplier
    const priorityMultMap = {
        high: cfg.highPriorityMultiplier,
        medium: cfg.mediumPriorityMultiplier,
        low: cfg.lowPriorityMultiplier
    };
    const priorityMult = priorityMultMap[task.priority] || 1.0;

    // Base points
    let points = Math.round(cfg.taskBasePoints * priorityMult);
    const priorityLabel = task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1);
    breakdown.push(`Base: ${cfg.taskBasePoints} × ${priorityMult} (${priorityLabel} priority) = ${points} pts`);

    // Deadline analysis
    const deadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
    const completedAt = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt || Date.now());
    const diffMs = deadline - completedAt;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 2) {
        // Early completion bonus
        const earlyBonus = cfg.earlyBonus;
        points += earlyBonus;
        breakdown.push(`Early completion bonus: +${earlyBonus} pts`);
    } else if (diffDays >= 0) {
        // On-time bonus
        const onTimeBonus = cfg.onTimeBonus;
        points += onTimeBonus;
        breakdown.push(`On-time completion bonus: +${onTimeBonus} pts`);
    } else {
        // Late — deduct per day
        const daysLate = Math.abs(Math.floor(diffDays));
        const deduction = Math.min(daysLate * cfg.lateDeductionPerDay, Math.abs(cfg.maxNegativePoints));
        points -= deduction;
        breakdown.push(`Late by ${daysLate} day(s): -${deduction} pts (${cfg.lateDeductionPerDay}/day)`);

        // Extra negative if beyond threshold
        if (daysLate >= cfg.negativeDeductionStart) {
            const extraPenalty = (daysLate - cfg.negativeDeductionStart + 1) * cfg.lateDeductionPerDay;
            points -= extraPenalty;
            breakdown.push(`Overdue penalty (>${cfg.negativeDeductionStart} days): -${extraPenalty} pts`);
        }

        // Floor
        points = Math.max(points, cfg.maxNegativePoints);
    }

    // Per-task override
    if (task.customPoints !== undefined) {
        points = task.customPoints;
        breakdown.length = 0;
        breakdown.push(`Custom override by admin: ${points} pts`);
    }

    return { points, breakdown };
}

/**
 * Preview points for a task without saving (used in task creation UI).
 */
export async function previewTaskPoints(taskData) {
    const config = await getPointsConfig();
    return calculateTaskPoints(taskData, config);
}

// ────────────────────────────────────────────
// Award / Deduct Points
// ────────────────────────────────────────────

/**
 * Award or deduct points for a user. Records a transaction.
 */
export async function awardPoints(userId, pointsDelta, type, description, taskId = null) {
    try {
        // Record transaction
        await addDoc(collection(db, 'point_transactions'), {
            userId,
            type,
            points: pointsDelta,
            taskId: taskId || null,
            description,
            awardedBy: window.CuteState?.user?.uid || 'system',
            timestamp: serverTimestamp()
        });

        // Update user totals (atomic increment)
        const userPointsRef = doc(db, 'user_points', userId);
        const snap = await getDoc(userPointsRef);

        if (snap.exists()) {
            await updateDoc(userPointsRef, {
                totalPoints: increment(pointsDelta),
                weeklyPoints: increment(pointsDelta),
                monthlyPoints: increment(pointsDelta),
                lastUpdated: serverTimestamp()
            });
        } else {
            await setDoc(userPointsRef, {
                userId,
                totalPoints: pointsDelta,
                weeklyPoints: pointsDelta,
                monthlyPoints: pointsDelta,
                lastUpdated: serverTimestamp()
            });
        }

        // Update level
        await updateUserLevel(userId);

        console.log(`[Points] Awarded ${pointsDelta} pts to ${userId}: ${description}`);
        return true;
    } catch (error) {
        console.error('[Points] Failed to award points:', error);
        return false;
    }
}

/**
 * Award points when a task is completed (called from tasks.js).
 */
export async function awardTaskCompletionPoints(task) {
    try {
        const config = await getPointsConfig();
        const { points, breakdown } = calculateTaskPoints(task, config);

        const description = points >= 0
            ? `Task completed: "${task.title}" (+${points} pts)`
            : `Task completed late: "${task.title}" (${points} pts)`;

        await awardPoints(
            task.assignedTo,
            points,
            points >= 0 ? 'task_completed' : 'task_late',
            description,
            task.id
        );

        return { points, breakdown };
    } catch (e) {
        console.error('[Points] Failed to award task points:', e);
        return { points: 0, breakdown: [] };
    }
}

/**
 * Admin manual point adjustment.
 */
export async function manualPointAdjust(userId, userName, pointsDelta, reason) {
    if (window.CuteState?.role !== 'admin') {
        throw new Error('Permission denied');
    }
    const description = `Manual adjustment by admin: ${reason}`;
    return await awardPoints(userId, pointsDelta, 'manual_adjust', description);
}

// ────────────────────────────────────────────
// Level Management
// ────────────────────────────────────────────

export async function getUserLevel(totalPoints) {
    const config = await getPointsConfig();
    if (totalPoints >= config.levelPlatinum) return 'Platinum';
    if (totalPoints >= config.levelGold) return 'Gold';
    if (totalPoints >= config.levelSilver) return 'Silver';
    return 'Bronze';
}

export async function updateUserLevel(userId) {
    try {
        const ref = doc(db, 'user_points', userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const total = snap.data().totalPoints || 0;
        const level = await getUserLevel(total);
        await updateDoc(ref, { level });
    } catch (e) {
        console.warn('[Points] Level update failed:', e);
    }
}

// ────────────────────────────────────────────
// Data Fetching
// ────────────────────────────────────────────

export async function getUserPoints(userId) {
    try {
        const ref = doc(db, 'user_points', userId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data();
        return { totalPoints: 0, weeklyPoints: 0, monthlyPoints: 0, level: 'Bronze' };
    } catch (e) {
        return { totalPoints: 0, weeklyPoints: 0, monthlyPoints: 0, level: 'Bronze' };
    }
}

export async function getAllUsersPoints() {
    try {
        const snapshot = await getDocs(collection(db, 'user_points'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('[Points] Failed to fetch all user points:', e);
        return [];
    }
}

export async function getUserTransactions(userId, limitCount = 50) {
    try {
        const q = query(
            collection(db, 'point_transactions'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('[Points] Failed to fetch transactions:', e);
        return [];
    }
}

export async function getAllTransactions(limitCount = 100) {
    try {
        const q = query(
            collection(db, 'point_transactions'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        return [];
    }
}

// ────────────────────────────────────────────
// Leaderboard
// ────────────────────────────────────────────

/**
 * Returns all users sorted by total points descending, with user info merged.
 */
export async function getLeaderboard() {
    try {
        const { getAllUsers } = await import('./users.js');
        const [allPoints, allUsers] = await Promise.all([getAllUsersPoints(), getAllUsers()]);

        const userMap = {};
        for (const u of allUsers) {
            userMap[u.id] = u;
        }

        const leaderboard = allPoints.map(p => ({
            ...p,
            userName: userMap[p.id]?.name || userMap[p.id]?.email || p.userId || 'Unknown',
            userPhoto: userMap[p.id]?.photoUrl || null,
            userEmail: userMap[p.id]?.email || ''
        }));

        leaderboard.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        return leaderboard;
    } catch (e) {
        console.error('[Points] Leaderboard failed:', e);
        return [];
    }
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

export function getLevelColor(level) {
    const map = {
        Bronze: { bg: '#fef3c7', color: '#d97706', icon: '🥉' },
        Silver: { bg: '#f1f5f9', color: '#64748b', icon: '🥈' },
        Gold: { bg: '#fef9c3', color: '#ca8a04', icon: '🥇' },
        Platinum: { bg: '#ede9fe', color: '#7c3aed', icon: '💎' }
    };
    return map[level] || map.Bronze;
}

export function getNextLevelInfo(totalPoints, config) {
    const cfg = config || DEFAULT_POINTS_CONFIG;
    if (totalPoints < cfg.levelSilver) {
        return { next: 'Silver', needed: cfg.levelSilver - totalPoints, progress: (totalPoints / cfg.levelSilver) * 100 };
    }
    if (totalPoints < cfg.levelGold) {
        return { next: 'Gold', needed: cfg.levelGold - totalPoints, progress: ((totalPoints - cfg.levelSilver) / (cfg.levelGold - cfg.levelSilver)) * 100 };
    }
    if (totalPoints < cfg.levelPlatinum) {
        return { next: 'Platinum', needed: cfg.levelPlatinum - totalPoints, progress: ((totalPoints - cfg.levelGold) / (cfg.levelPlatinum - cfg.levelGold)) * 100 };
    }
    return { next: null, needed: 0, progress: 100 };
}
