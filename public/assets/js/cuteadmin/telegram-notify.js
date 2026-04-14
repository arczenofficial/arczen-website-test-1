// Telegram Notification Helper
// Call this after creating a task to send notifications

import { CONFIG } from '../config.js';

export async function sendTaskNotification(taskData, actionType = 'task_created') {
    // URL imported from gitignored config file
    const APPSCRIPT_URL = CONFIG.APPSCRIPT_URL;

    try {
        // Apps Script Web Apps require 'no-cors' mode when called from a browser
        // Limitations: We cannot read the response JSON, but the request will succeed.
        await fetch(APPSCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // <--- This fixes the CORS error
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: actionType, // 'task_created' or 'task_completed'
                task: taskData
            })
        });

        console.log("Telegram notification sent (opaque response in no-cors mode)");

    } catch (error) {
        console.error("Error sending Telegram notifications:", error);
    }
}
