// Telegram Notification Helper
import { CONFIG } from '../config.js';

export async function sendTaskNotification(taskData, actionType = 'task_created') {
    const APPSCRIPT_URL = CONFIG.APPSCRIPT_URL;
    try {
        await fetch(APPSCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: actionType, task: taskData })
        });
    } catch (error) { console.error("Error sending Telegram notifications:", error); }
}

export async function sendOrderNotification(orderData) {
    const APPSCRIPT_URL = CONFIG.APPSCRIPT_URL || window.CuteState?.APPSCRIPT_URL;
    if (!APPSCRIPT_URL) return;

    try {
        await fetch(APPSCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'order_placed', order: orderData })
        });
        console.log("Order Telegram notification sent.");
    } catch (error) { console.error("Error sending Order Telegram notification:", error); }
}
