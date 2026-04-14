// Task Management Module - Full CRUD Operations
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';
import { logAction } from './db.js';
import { sendTaskNotification } from './telegram-notify.js';
import { awardTaskCompletionPoints } from './points.js';



// Create new task (handles multiple assignees by creating individual tasks)
export async function createTask(taskData) {
    console.log("[Tasks] createTask called with:", taskData);
    try {
        const results = [];
        const { assignees, ...baseData } = taskData;

        if (!assignees || !Array.isArray(assignees)) {
            throw new Error("No assignees selected or invalid assignee data");
        }

        for (const assignee of assignees) {
            console.log("[Tasks] Creating task for assignee:", assignee);

            if (!assignee.uid) {
                console.warn("[Tasks] Assignee UID is missing for:", assignee.name);
                continue; // Skip if no UID
            }

            const task = {
                title: baseData.title || "Untitled Task",
                description: baseData.description || "",
                status: 'pending',
                priority: baseData.priority || 'medium',
                deadline: baseData.deadline || new Date(),
                referenceLinks: baseData.referenceLinks || [],
                // Customer & Project linking (from IMS)
                customerId: baseData.customerId || null,
                customerName: baseData.customerName || "",
                projectId: baseData.projectId || null,
                projectName: baseData.projectName || "",
                // Points config (optional per-task override)
                customPoints: baseData.customPoints !== undefined ? baseData.customPoints : null,
                // Assignee info
                assignedTo: assignee.uid,
                assignedToName: assignee.name || "Unknown User",
                assignedToPhoto: assignee.photo || "",
                createdBy: window.CuteState.user.uid,
                createdByName: window.CuteState.user.displayName || window.CuteState.user.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "tasks"), task);
            results.push(docRef.id);

            // Log activity
            await logAction(
                window.CuteState.user.uid,
                "task_created",
                `Created task "${task.title}" for ${task.assignedToName}`,
                docRef.id
            );

            // Trigger notification
            await createNotification(task.assignedTo, {
                type: 'task_assigned',
                taskId: docRef.id,
                taskTitle: task.title,
                message: `You have been assigned: ${task.title}`
            });

            // Trigger Telegram Notification
            // CRITICAL: Add the new ID to the task object so the Sheet knows it!
            const taskWithId = { ...task, id: docRef.id };
            sendTaskNotification(taskWithId, 'task_created');
        }

        if (results.length > 0) {
            showToast(`${results.length} Task(s) created successfully!`, "success");
        } else {
            showToast("No tasks were created. Please check assignees.", "warning");
        }
        return results;
    } catch (error) {
        console.error("Error creating task:", error);
        showToast("Failed to create task: " + error.message, "error");
        throw error;
    }
}

// Update task
export async function updateTask(taskId, updates, silent = false) {
    try {
        const taskRef = doc(db, "tasks", taskId);
        const taskSnap = await getDoc(taskRef);
        const oldData = taskSnap.data();

        const updateData = {
            ...updates,
            updatedAt: serverTimestamp()
        };

        // Handle completion metadata
        if (updates.status === 'done' && oldData.status !== 'done') {
            updateData.completedAt = serverTimestamp();
            updateData.completedBy = window.CuteState.user.uid;
        } else if (updates.status && updates.status !== 'done' && oldData.status === 'done') {
            // Task moved back from done (e.g. to in_progress), clear completion data
            updateData.completedAt = null;
            updateData.completedBy = null;
        }

        await updateDoc(taskRef, updateData);

        // Detect specific changes and create detailed log
        const changes = [];

        if (updates.title && updates.title !== oldData.title) {
            changes.push(`title from "${oldData.title}" to "${updates.title}"`);
        }
        if (updates.description && updates.description !== oldData.description) {
            changes.push(`description`);
        }
        if (updates.priority && updates.priority !== oldData.priority) {
            changes.push(`priority from ${oldData.priority} to ${updates.priority}`);
        }
        if (updates.deadline && updates.deadline !== oldData.deadline) {
            const oldDate = oldData.deadline?.toDate ? oldData.deadline.toDate() : new Date(oldData.deadline);
            const newDate = updates.deadline instanceof Date ? updates.deadline : new Date(updates.deadline);
            changes.push(`deadline from ${oldDate.toLocaleDateString()} to ${newDate.toLocaleDateString()}`);
        }
        if (updates.assignedTo && updates.assignedTo !== oldData.assignedTo) {
            changes.push(`assignee from ${oldData.assignedToName} to ${updates.assignedToName || 'someone'}`);
        }
        if (updates.status && updates.status !== oldData.status) {
            changes.push(`status from ${oldData.status} to ${updates.status}`);
        }

        // Create appropriate log message
        let logDetails;
        if (changes.length > 0) {
            logDetails = `Edited "${oldData.title}" - changed ${changes.join(', ')}`;
        } else {
            logDetails = `Updated task "${oldData.title}"`;
        }

        if (silent) {
            // For "Ultimate Hand" updates, we log to system audit but skip public feed and notifications
            // We can dynamically import to avoid circular dep issues if any, though logSystemAction is in db.js
            const { logSystemAction } = await import('./db.js');
            await logSystemAction('ultimate_update', logDetails, { taskId });
            console.log('[Tasks] Silent update performed. Notifications suppressed.');
            return;
        }

        await logAction(
            window.CuteState.user.uid,
            "task_updated",
            logDetails,
            taskId
        );

        // If reassigned, notify new assignee
        if (updates.assignedTo && updates.assignedTo !== oldData.assignedTo) {
            await createNotification(updates.assignedTo, {
                type: 'task_reassigned',
                taskId: taskId,
                taskTitle: oldData.title,
                message: `Task reassigned to you: ${oldData.title}`
            });
        }

        // If completed, send Telegram notification ALWAYS
        if (updates.status === 'done' && oldData.status !== 'done') {
            // Prepare task data for webhook with serializable timestamps
            const now = new Date();
            const completedTask = {
                ...oldData,
                ...updates,
                id: taskId,
                // Convert Firestore Timestamps to ISO strings for serialization
                createdAt: oldData.createdAt?.toDate ? oldData.createdAt.toDate().toISOString() : (oldData.createdAt || now.toISOString()),
                completedAt: now.toISOString(), // Use actual current time instead of serverTimestamp
                completedBy: window.CuteState.user.uid,
                // Convert deadline to serializable format if it exists
                deadline: oldData.deadline?.toDate ? oldData.deadline.toDate().toISOString() : oldData.deadline
            };

            console.log('[Tasks] Sending task_completed notification with data:', completedTask);
            sendTaskNotification(completedTask, 'task_completed');

            // Award points to the assignee
            try {
                const { points, breakdown } = await awardTaskCompletionPoints(completedTask);
                console.log(`[Tasks] Awarded ${points} pts for task "${completedTask.title}":`, breakdown);
            } catch (pErr) {
                console.error('[Tasks] Points award failed (non-fatal):', pErr);
            }

            // Also notify task creator via in-app notification (only if different from completer)
            if (oldData.createdBy !== window.CuteState.user.uid) {
                await createNotification(oldData.createdBy, {
                    type: 'task_completed',
                    taskId: taskId,
                    taskTitle: oldData.title,
                    message: `${oldData.assignedToName} completed task: ${oldData.title}`
                });
            }
        } else if (updates.status && updates.status !== 'done') {
            // For any other update (in_progress, edit title, etc.), sync to Sheet
            const updatedTask = {
                ...oldData,
                ...updates,
                id: taskId,
                // Convert timestamps for serialization
                createdAt: oldData.createdAt?.toDate ? oldData.createdAt.toDate().toISOString() : oldData.createdAt,
                deadline: oldData.deadline?.toDate ? oldData.deadline.toDate().toISOString() : oldData.deadline
            };
            sendTaskNotification(updatedTask, 'task_updated');
        }

        showToast("Task updated!", "success");
    } catch (error) {
        console.error("Error updating task:", error);
        showToast("Failed to update task", "error");
        throw error;
    }
}

// Get completed tasks archive
export async function getCompletedTasks(filters = {}) {
    try {
        const viewMode = window.CuteState.viewMode || window.CuteState.role;
        const userId = window.CuteState.user.uid;

        let q;
        if (viewMode === 'employee') {
            // Employees see only their own completed tasks
            q = query(
                collection(db, "tasks"),
                where("status", "==", "done"),
                where("assignedTo", "==", userId)
            );
        } else {
            // Admins/Mods see ALL completed tasks
            q = query(
                collection(db, "tasks"),
                where("status", "==", "done")
                // orderBy("completedAt", "desc") // Requires index, will sort client-side for now
            );
        }

        const querySnapshot = await getDocs(q);
        const tasks = [];

        querySnapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() });
        });

        // Client-side sorting by completedAt (newest first)
        tasks.sort((a, b) => {
            const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(0);
            const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(0);
            return dateB - dateA;
        });

        // Apply filters
        let filtered = tasks;
        if (filters.priority) filtered = filtered.filter(t => t.priority === filters.priority);
        if (filters.assignedTo) filtered = filtered.filter(t => t.assignedTo === filters.assignedTo);

        return filtered;

    } catch (error) {
        console.error("Error fetching completed tasks:", error);
        throw error;
    }
}

// Delete task
export async function deleteTask(taskId, silent = false) {
    try {
        const taskRef = doc(db, "tasks", taskId);
        const taskSnap = await getDoc(taskRef);
        const taskData = taskSnap.data();

        await deleteDoc(taskRef);

        if (silent) {
            const { logSystemAction } = await import('./db.js');
            await logSystemAction('ultimate_delete', `Deleted task: ${taskData.title}`, { taskId });
            return;
        }

        await logAction(
            window.CuteState.user.uid,
            "task_deleted",
            `Deleted task: ${taskData.title}`,
            taskId
        );

        showToast("Task deleted", "success");
    } catch (error) {
        console.error("Error deleting task:", error);
        showToast("Failed to delete task", "error");
        throw error;
    }
}

// Get tasks based on role
export async function getTasks(filters = {}) {
    try {
        // Use viewMode for filtering, not the real role
        // This ensures "View As" actually filters the data
        const viewMode = window.CuteState.viewMode || window.CuteState.role;
        const userId = window.CuteState.user.uid;

        console.log('[Tasks] Fetching tasks for viewMode:', viewMode, 'userId:', userId);

        let q;

        if (viewMode === 'employee') {
            // When viewing as employee, see only assigned tasks
            // NOTE: We removed orderBy("createdAt") here to avoid "Missing Index" error
            // since we are filtering by assignedTo. We will sort client-side.
            console.log('[Tasks] Employee mode: filtering by assignedTo =', userId);
            q = query(
                collection(db, "tasks"),
                where("assignedTo", "==", userId)
            );
        } else {
            // Admin and Moderator (when not viewing as employee) see all tasks
            console.log('[Tasks] Admin/Moderator mode: fetching all tasks');
            q = query(
                collection(db, "tasks"),
                orderBy("createdAt", "desc")
            );
        }

        const querySnapshot = await getDocs(q);
        const tasks = [];

        querySnapshot.forEach((doc) => {
            const taskData = { id: doc.id, ...doc.data() };

            // Hotfix: Rename Shariar Hasan (Frontend Display)
            if (taskData.assignedToName === "Shariar Hasan") taskData.assignedToName = "Shariar Hassan";
            if (taskData.createdByName === "Shariar Hasan") taskData.createdByName = "Shariar Hassan";

            tasks.push(taskData);

            // Log each task for debugging employee issues
            if (viewMode === 'employee') {
                console.log('[Tasks] Task found:', {
                    id: taskData.id,
                    title: taskData.title,
                    assignedTo: taskData.assignedTo,
                    assignedToName: taskData.assignedToName,
                    matchesUser: taskData.assignedTo === userId
                });
            }
        });

        console.log('[Tasks] Retrieved', tasks.length, 'tasks from Firestore');
        if (viewMode === 'employee' && tasks.length === 0) {
            console.warn('[Tasks] Employee has ZERO assigned tasks. Check Firebase to ensure tasks are assigned to userId:', userId);
            console.warn('[Tasks] Task assignment should have assignedTo field matching this userId');
        } else if (viewMode === 'employee') {
            console.log('[Tasks] Employee tasks summary:', tasks.map(t => ({
                title: t.title,
                status: t.status,
                assignedTo: t.assignedTo
            })));
        }

        // Sort client-side to ensure consistency
        tasks.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA; // Descending
        });

        // Apply additional filters
        let filtered = tasks;

        if (filters.status) {
            filtered = filtered.filter(t => t.status === filters.status);
        }

        if (filters.priority) {
            filtered = filtered.filter(t => t.priority === filters.priority);
        }

        if (filters.assignedTo) {
            filtered = filtered.filter(t => t.assignedTo === filters.assignedTo);
        }

        // Check for overdue
        const now = new Date();
        filtered = filtered.map(task => {
            if (task.deadline && task.status !== 'done') {
                const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
                if (deadline < now) {
                    task.isOverdue = true;
                }
            }
            return task;
        });

        console.log('[Tasks] Returning', filtered.length, 'tasks after filtering');
        return filtered;
    } catch (error) {
        console.error("[Tasks] Error fetching tasks:", error);
        console.error("[Tasks] Error details:", error.message, error.stack);
        throw error;
    }
}

// Get single task
export async function getTask(taskId) {
    try {
        const taskRef = doc(db, "tasks", taskId);
        const taskSnap = await getDoc(taskRef);

        if (taskSnap.exists()) {
            return { id: taskSnap.id, ...taskSnap.data() };
        } else {
            throw new Error("Task not found");
        }
    } catch (error) {
        console.error("Error fetching task:", error);
        throw error;
    }
}

// Create notification
async function createNotification(userId, notificationData) {
    try {
        await addDoc(collection(db, "notifications"), {
            userId: userId,
            type: notificationData.type,
            taskId: notificationData.taskId,
            taskTitle: notificationData.taskTitle,
            message: notificationData.message,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

// Get user notifications
export async function getNotifications(userId) {
    try {
        const q = query(
            collection(db, "notifications"),
            where("userId", "==", userId),
            where("read", "==", false),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const notifications = [];

        querySnapshot.forEach((doc) => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        return notifications;
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

// Mark notification as read
export async function markNotificationRead(notificationId) {
    try {
        const notifRef = doc(db, "notifications", notificationId);
        await updateDoc(notifRef, { read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

// Get task statistics
export async function getTaskStats() {
    try {
        const tasks = await getTasks();

        const stats = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
            overdue: tasks.filter(t => t.isOverdue).length,
            highPriority: tasks.filter(t => t.priority === 'high').length
        };

        // Calculate completion rate
        if (stats.total > 0) {
            stats.completionRate = Math.round((stats.done / stats.total) * 100);
        } else {
            stats.completionRate = 0;
        }

        return stats;
    } catch (error) {
        console.error("Error calculating stats:", error);
        return {
            total: 0,
            pending: 0,
            inProgress: 0,
            done: 0,
            overdue: 0,
            highPriority: 0,
            completionRate: 0
        };
    }
}
