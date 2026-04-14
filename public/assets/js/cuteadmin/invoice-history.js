import {
    collection,
    getDocs,
    query,
    orderBy,
    where,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { getInvoices } from './invoices.js';
import { showToast } from './utils.js';
const INVOICE_LOGS_COLLECTION = "invoiceLogs";

/**
 * Get invoice edit history (Admin only)
 * @param {string} invoiceId - Invoice document ID
 * @returns {Promise<Array>} - Array of log entries
 */
export async function getInvoiceHistory(invoiceId) {
    try {
        const role = window.CuteState?.role;
        if (role !== 'admin' && role !== 'moderator') {
            console.warn("Invoice history is restricted to admin and moderator");
            return [];
        }

        console.log(`[Invoice History] Fetching logs for invoice: ${invoiceId}`);

        // Try with orderBy first (requires composite index)
        let q = query(
            collection(db, INVOICE_LOGS_COLLECTION),
            where("invoiceId", "==", invoiceId),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        let snapshot;
        try {
            snapshot = await getDocs(q);
        } catch (indexError) {
            // If composite index doesn't exist, fallback to simple query
            console.warn("[Invoice History] Composite index not found, using fallback query", indexError.message);
            q = query(
                collection(db, INVOICE_LOGS_COLLECTION),
                where("invoiceId", "==", invoiceId),
                limit(50)
            );
            snapshot = await getDocs(q);
        }

        const logs = [];
        snapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
        });

        // Sort manually if we used fallback query
        logs.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
            return timeB - timeA; // Descending
        });

        console.log(`[Invoice History] Found ${logs.length} log entries`);
        if (logs.length === 0) {
            console.warn(`[Invoice History] No logs found for invoice ${invoiceId}. Check if logs are being created.`);
        }
        return logs;
    } catch (error) {
        console.error("[Invoice History] Error fetching invoice history:", error);
        console.error("[Invoice History] Error details:", error.code, error.message);
        showToast(`Failed to load history: ${error.message}`, "error");
        return [];
    }
}

/**
 * Format action for display
 */
function formatAction(action) {
    const actionMap = {
        'created': { label: 'Created', icon: 'add_circle', color: '#10b981' },
        'updated': { label: 'Updated', icon: 'edit', color: '#3b82f6' },
        'issued': { label: 'Issued', icon: 'send', color: '#8b5cf6' },
        'payment_added': { label: 'Payment Added', icon: 'payments', color: '#10b981' },
        'payment_removed': { label: 'Payment Removed', icon: 'money_off', color: '#ef4444' },
        'cancelled': { label: 'Cancelled', icon: 'cancel', color: '#ef4444' },
        'locked': { label: 'Locked', icon: 'lock', color: '#f59e0b' },
        'unlocked': { label: 'Unlocked', icon: 'lock_open', color: '#10b981' },
        'deleted': { label: 'Deleted', icon: 'delete', color: '#ef4444' }
    };
    return actionMap[action] || { label: action, icon: 'info', color: '#64748b' };
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    // Handle Firestore timestamp/Date/String
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Show invoice history modal (Admin only)
 */
export async function showInvoiceHistoryModal(invoiceId, invoiceNumber) {
    const role = window.CuteState?.role;
    if (role !== 'admin' && role !== 'moderator') {
        showToast("Only admins and moderators can view invoice history", "error");
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal ims-modal history-modal';
    modal.innerHTML = `
        <div class="modal-content ims-modal-content" style="max-width: 800px;">
            <div class="modal-header ims-modal-header">
                <h2><i class="material-icons-round">history</i> Invoice History</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="history-info" style="background: #f1f5f9; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <strong>Invoice:</strong> ${invoiceNumber}
            </div>
            <div id="historyContent" style="max-height: 500px; overflow-y: auto;">
                <div class="initial-loader"><div class="spinner"></div><p>Loading history...</p></div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const logs = await getInvoiceHistory(invoiceId);
    const contentDiv = document.getElementById('historyContent');

    if (logs.length === 0) {
        contentDiv.innerHTML = `
            <div class="empty-state-ims" style="padding: 2rem;">
                <i class="material-icons-round">history</i>
                <h3>No History Found</h3>
                <p>No changes have been recorded for this invoice.</p>
            </div>
        `;
        return;
    }

    contentDiv.innerHTML = `
        <div class="history-timeline">
            ${logs.map(log => {
        const action = formatAction(log.action);

        // Parse snapshots from JSON strings if relevant (our new logger stores strings)
        let newValueObj = null;
        try {
            newValueObj = log.newValue ? JSON.parse(log.newValue) : null;
        } catch (e) { newValueObj = log.newValue; }

        return `
                    <div class="history-item">
                        <div class="history-icon" style="background: ${action.color}20; color: ${action.color};">
                            <i class="material-icons-round">${action.icon}</i>
                        </div>
                        <div class="history-content">
                            <div class="history-header">
                                <strong>${action.label}</strong>
                                <span class="history-time">${formatTimestamp(log.timestamp)}</span>
                            </div>
                            <div class="history-user" style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
                                Changed by <strong>${log.changedByName || 'System'}</strong> (${log.userEmail || 'N/A'})
                            </div>
                            <div style="font-size: 0.8rem; color: #64748b;">
                                IP: <strong>${log.ipAddress || 'Unknown'}</strong>
                            </div>
                            ${log.details ? `
                                <div class="history-details-text" style="margin-top: 6px; font-size: 0.9rem; color: #334155; padding: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;">
                                    ${log.details}
                                </div>
                            ` : ''}
                            
                            <div style="margin-top: 6px; font-size: 0.8rem; color: #94a3b8;">
                                User Agent: ${truncateUA(log.userAgent) || 'Unknown'}
                            </div>

                            <details class="history-details" style="margin-top: 8px;">
                                <summary>Raw Data Snapshot</summary>
                                <pre style="font-size: 11px; max-height: 150px; overflow: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-top: 5px;">${JSON.stringify(newValueObj || {}, null, 2)}</pre>
                            </details>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function truncateUA(ua) {
    if (!ua) return '';
    if (ua.length > 50) return ua.substring(0, 50) + '...';
    return ua;
}

window.showInvoiceHistoryModal = showInvoiceHistoryModal;
