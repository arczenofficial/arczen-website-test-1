// CSV Export Module for QuestAdmin
import { getTasks } from './tasks.js';
import { getAllUsers } from './users.js';
import { getGlobalLogs } from './db.js';

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data, headers) {
    if (!data || data.length === 0) return '';

    // Get headers from first object if not provided
    const csvHeaders = headers || Object.keys(data[0]);

    // Create header row
    const headerRow = csvHeaders.join(',');

    // Create data rows
    const dataRows = data.map(row => {
        return csvHeaders.map(header => {
            let value = row[header];

            // Handle special cases
            if (value === null || value === undefined) {
                return '';
            }

            // Handle dates
            if (value?.toDate) {
                value = value.toDate().toLocaleString();
            } else if (value instanceof Date) {
                value = value.toLocaleString();
            }

            // Handle objects/arrays
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            // Escape quotes and wrap in quotes if contains comma
            value = String(value).replace(/"/g, '""');
            if (value.includes(',') || value.includes('\n') || value.includes('"')) {
                value = `"${value}"`;
            }

            return value;
        }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export tasks to CSV
 */
export async function exportTasksCSV() {
    try {
        const tasks = await getTasks();

        // Format tasks for export
        const formattedTasks = tasks.map(task => ({
            'Task ID': task.id,
            'Title': task.title,
            'Description': task.description,
            'Status': task.status,
            'Priority': task.priority,
            'Assigned To': task.assignedToName,
            'Assigned To UID': task.assignedTo,
            'Created By': task.createdByName,
            'Created At': task.createdAt,
            'Updated At': task.updatedAt,
            'Deadline': task.deadline,
            'Completion Notes': task.completionNotes || '',
            'File Link': task.fileLink || '',
            'Delivery Method': task.deliveryMethod || '',
            'Completed At': task.completedAt || '',
            'Is Overdue': task.isOverdue ? 'Yes' : 'No'
        }));

        const csv = convertToCSV(formattedTasks);
        const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;

        downloadCSV(csv, filename);

        return { success: true, count: formattedTasks.length };
    } catch (error) {
        console.error('Error exporting tasks:', error);
        throw error;
    }
}

/**
 * Export users to CSV
 */
export async function exportUsersCSV() {
    try {
        const users = await getAllUsers();

        // Format users for export
        const formattedUsers = users.map(user => ({
            'User ID': user.id,
            'Name': user.name,
            'Email': user.email,
            'Role': user.role,
            'Title': user.title || '',
            'Status': user.status,
            'Telegram ID': user.telegramId || '',
            'Created At': user.createdAt,
            'Last Active': user.lastActive || user.lastActiveAt || '',
            'Last Login': user.lastLogin || '',
            'Last Login IP': user.lastLoginIP || '',
            'Is Active': user.isActive ? 'Yes' : 'No'
        }));

        const csv = convertToCSV(formattedUsers);
        const filename = `users_export_${new Date().toISOString().split('T')[0]}.csv`;

        downloadCSV(csv, filename);

        return { success: true, count: formattedUsers.length };
    } catch (error) {
        console.error('Error exporting users:', error);
        throw error;
    }
}

/**
 * Export activity logs to CSV
 */
export async function exportLogsCSV() {
    try {
        const logs = await getGlobalLogs();

        // Format logs for export
        const formattedLogs = logs.map(log => ({
            'Log ID': log.id,
            'User Email': log.userEmail,
            'Action': log.action,
            'Description': log.description,
            'Timestamp': log.timestamp,
            'IP Address': log.ipAddress || '',
            'User Agent': log.userAgent || '',
            'Resource ID': log.resourceId || ''
        }));

        const csv = convertToCSV(formattedLogs);
        const filename = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;

        downloadCSV(csv, filename);

        return { success: true, count: formattedLogs.length };
    } catch (error) {
        console.error('Error exporting logs:', error);
        throw error;
    }
}

/**
 * Export all data (tasks, users, logs)
 */
export async function exportAllData() {
    try {
        const results = await Promise.all([
            exportTasksCSV(),
            exportUsersCSV(),
            exportLogsCSV()
        ]);

        const totalRecords = results.reduce((sum, r) => sum + r.count, 0);

        return {
            success: true,
            message: `Exported ${totalRecords} records across 3 files`,
            details: {
                tasks: results[0].count,
                users: results[1].count,
                logs: results[2].count
            }
        };
    } catch (error) {
        console.error('Error exporting all data:', error);
        throw error;
    }
}

// Make functions globally accessible
window.exportTasksCSV = exportTasksCSV;
window.exportUsersCSV = exportUsersCSV;
window.exportLogsCSV = exportLogsCSV;
window.exportAllData = exportAllData;
