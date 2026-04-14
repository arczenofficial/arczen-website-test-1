// Invoice Management Module for IMS
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    serverTimestamp,
    query,
    orderBy,
    where,
    increment,
    runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';


const INVOICES_COLLECTION = "invoices";
const DELETED_INVOICES_COLLECTION = "deleted_invoices";
const INVOICE_LOGS_COLLECTION = "invoiceLogs";
const EXPORTED_INVOICES_COLLECTION = "exported_invoices";

// Invoice status constants
export const INVOICE_STATUS = {
    DRAFT: "draft",
    ISSUED: "issued",
    PARTIALLY_PAID: "partially_paid",
    PAID: "paid",
    OVERDUE: "overdue",
    CANCELLED: "cancelled",
    LOCKED: "locked"
};

/**
 * Log an invoice export (PDF/Image/Print)
 */
export async function logInvoiceExport(invoiceId, exportType, snapshotData) {
    try {
        console.log(`[Invoice Export] Logging export for invoice ${invoiceId}, type: ${exportType}`);

        const logEntry = {
            invoiceId,
            exportType, // 'pdf', 'image', 'print'
            exportedBy: window.CuteState?.user?.uid || "system",
            exportedByName: window.CuteState?.userProfile?.name || "System",
            exportedAt: serverTimestamp(),
            // Store comprehensive snapshot
            snapshot: {
                invoice: snapshotData.invoice,
                customer: snapshotData.customer,
                company: snapshotData.company,
                timestamp: snapshotData.timestamp || new Date().toISOString()
            }
        };

        const docRef = await addDoc(collection(db, EXPORTED_INVOICES_COLLECTION), logEntry);
        console.log(`[Invoice Export] ✅ Export log created with ID: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        console.error(`[Invoice Export] ❌ Failed to log export:`, error);
        // We generally shouldn't block the actual download if logging fails, 
        // but we should warn the admin if possible.
        return null;
    }
}

/**
 * Get exported invoices history
 */
export async function getExportedInvoices() {
    try {
        const q = query(
            collection(db, EXPORTED_INVOICES_COLLECTION),
            orderBy("exportedAt", "desc")
        );

        const snapshot = await getDocs(q);
        const exports = [];
        snapshot.forEach((doc) => {
            exports.push({ id: doc.id, ...doc.data() });
        });
        return exports;
    } catch (error) {
        console.error("Error fetching exported invoices:", error);
        return [];
    }
}

// Start: Utils for deep diffing
function getObjectDiff(obj1, obj2) {
    const diff = {};
    Object.keys(obj1).forEach(key => {
        if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
            diff[key] = {
                old: obj1[key],
                new: obj2[key]
            };
        }
    });
    Object.keys(obj2).forEach(key => {
        if (obj1[key] === undefined) {
            diff[key] = {
                old: undefined,
                new: obj2[key]
            };
        }
    });
    return diff;
}
// End: Utils

/**
 * Generate next invoice number
 */
export async function generateInvoiceNumber() {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${yearMonth}-`;

    try {
        const q = query(
            collection(db, INVOICES_COLLECTION),
            orderBy("invoiceNumber", "desc")
        );
        const snapshot = await getDocs(q);

        let maxNum = 0;
        snapshot.forEach((doc) => {
            const num = doc.data().invoiceNumber;
            if (num && num.startsWith(prefix)) {
                const seq = parseInt(num.split('-')[2], 10);
                if (seq > maxNum) maxNum = seq;
            }
        });

        return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
    } catch (error) {
        console.error("Error generating invoice number:", error);
        return `${prefix}${Date.now().toString().slice(-4)}`;
    }
}

/**
 * Get all invoices
 */
export async function getInvoices(status = "all") {
    try {
        let q;
        if (status === "all") {
            q = query(collection(db, INVOICES_COLLECTION), orderBy("createdAt", "desc"));
        } else {
            q = query(
                collection(db, INVOICES_COLLECTION),
                where("status", "==", status),
                orderBy("createdAt", "desc")
            );
        }

        const snapshot = await getDocs(q);
        const invoices = [];
        snapshot.forEach((doc) => {
            invoices.push({ id: doc.id, ...doc.data() });
        });
        return invoices;
    } catch (error) {
        console.error("Error fetching invoices:", error);
        return [];
    }
}

/**
 * Get single invoice
 */
export async function getInvoice(invoiceId) {
    try {
        const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching invoice:", error);
        return null;
    }
}

/**
 * Create a new invoice
 */
export async function createInvoice(invoiceData) {
    try {
        const invoiceNumber = await generateInvoiceNumber();

        const docRef = await addDoc(collection(db, INVOICES_COLLECTION), {
            invoiceNumber,
            status: INVOICE_STATUS.DRAFT,
            customerId: invoiceData.customerId || null,
            customerSnapshot: invoiceData.customerSnapshot || null,
            projectId: invoiceData.projectId || null,
            date: invoiceData.date || new Date().toISOString().split('T')[0],
            dueDate: invoiceData.dueDate || null,
            items: invoiceData.items || [],
            subtotal: invoiceData.subtotal || 0,
            discount: invoiceData.discount || 0,
            discountType: invoiceData.discountType || "fixed",
            tax: invoiceData.tax || 0,
            taxRate: invoiceData.taxRate || 0,
            total: invoiceData.total || 0,
            payments: [],
            totalPaid: 0,
            dueAmount: invoiceData.total || 0,
            terms: invoiceData.terms || "",
            notes: invoiceData.notes || "",
            signature: null,
            version: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: window.CuteState?.user?.uid || "system"
        });

        const fullSnapshot = {
            id: docRef.id,
            invoiceNumber,
            ...invoiceData,
            status: INVOICE_STATUS.DRAFT,
            totalPaid: 0
        };

        await logInvoiceAction(docRef.id, "created", null, fullSnapshot, "Created new invoice");

        showToast(`Invoice ${invoiceNumber} created as draft`, "success");
        return docRef.id;
    } catch (error) {
        console.error("Error creating invoice:", error);
        showToast(`Failed to create invoice: ${error.message}`, "error");
        return null;
    }
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(invoiceId, updates, silent = false) {
    const role = window.CuteState?.role;
    console.log(`[Invoice Update] Attempting to update invoice ${invoiceId}`, updates);

    if (role !== 'admin' && role !== 'moderator') {
        if (!silent) showToast("Permission denied: Only Admins/Moderators can edit invoices", "error");
        console.warn(`[Invoice Update] Permission denied for role: ${role}`);
        return false;
    }

    try {
        const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
        const existing = await getInvoice(invoiceId);

        if (!existing) {
            showToast("Invoice not found", "error");
            return false;
        }

        if (existing.status === INVOICE_STATUS.LOCKED && role !== 'admin') {
            showToast("This invoice is locked.", "error");
            return false;
        }

        // Logic check
        if (updates.items) {
            updates.subtotal = updates.items.reduce((sum, item) => sum + (item.total || 0), 0);
        }

        if (updates.total !== undefined || updates.totalPaid !== undefined) {
            const total = updates.total !== undefined ? updates.total : existing.total;
            const totalPaid = updates.totalPaid !== undefined ? updates.totalPaid : existing.totalPaid;
            updates.dueAmount = total - totalPaid;
        }

        console.log(`[Invoice Update] Updating Firestore document...`);
        await updateDoc(docRef, {
            ...updates,
            version: increment(1),
            updatedAt: serverTimestamp()
        });
        console.log(`[Invoice Update] ✅ Firestore document updated successfully`);

        // Calculate diff for logging
        const diff = getObjectDiff(existing, { ...existing, ...updates });
        const diffSummary = Object.keys(diff).map(key => `${key}: ${JSON.stringify(diff[key].old)} -> ${JSON.stringify(diff[key].new)}`).join(', ');

        console.log(`[Invoice Update] Changes detected:`, diffSummary);

        const fullSnapshot = { ...existing, ...updates, version: (existing.version || 1) + 1 };
        console.log(`[Invoice Update] Calling logInvoiceAction...`);
        await logInvoiceAction(invoiceId, "updated", existing, fullSnapshot, `Updated invoice fields: ${diffSummary}`);

        if (!silent) showToast("Invoice updated", "success");
        return true;
    } catch (error) {
        console.error("[Invoice Update] ❌ Error updating invoice:", error);
        showToast(`Failed to update invoice: ${error.message}`, "error");
        return false;
    }
}

/**
 * Issue an invoice
 */
export async function issueInvoice(invoiceId) {
    const role = window.CuteState?.role;
    if (role !== 'admin' && role !== 'moderator') {
        showToast("Permission denied: Only Admins/Moderators can issue invoices", "error");
        return false;
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) return false;

    if (invoice.status !== INVOICE_STATUS.DRAFT) {
        showToast("Only draft invoices can be issued", "error");
        return false;
    }

    if (!invoice.customerId || invoice.items.length === 0) {
        showToast("Invoice must have a customer and at least one item", "error");
        return false;
    }

    const result = await updateInvoice(invoiceId, {
        status: INVOICE_STATUS.ISSUED,
        issuedAt: new Date().toISOString() // Store as ISO string for better JSON portability
    });

    if (result) {
        showToast("Invoice issued successfully!", "success");
    }
    return result;
}

/**
 * Add a payment to an invoice
 */
export async function addPayment(invoiceId, payment) {
    const role = window.CuteState?.role;
    if (role !== 'admin' && role !== 'moderator') {
        showToast("Permission denied: Only Admins/Moderators can record payments", "error");
        return false;
    }

    try {
        const invoice = await getInvoice(invoiceId);
        if (!invoice) return false;

        if (invoice.status === INVOICE_STATUS.DRAFT) {
            showToast("Cannot add payment to draft invoice", "error");
            return false;
        }

        const newPayment = {
            id: Date.now().toString(),
            amount: payment.amount,
            method: payment.method || "cash",
            date: payment.date || new Date().toISOString().split('T')[0],
            note: payment.note || "",
            addedAt: new Date().toISOString(),
            addedBy: window.CuteState?.user?.uid || "system"
        };

        const updatedPayments = [...(invoice.payments || []), newPayment];
        const totalPaid = updatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const dueAmount = invoice.total - totalPaid;

        let newStatus = invoice.status;
        if (dueAmount <= 0) {
            newStatus = INVOICE_STATUS.PAID;
        } else if (totalPaid > 0) {
            newStatus = INVOICE_STATUS.PARTIALLY_PAID;
        }

        const success = await updateInvoice(invoiceId, {
            payments: updatedPayments,
            totalPaid,
            dueAmount,
            status: newStatus
        }, true);

        if (success) {
            showToast("Payment recorded successfully", "success");
            // Log specifically for payments (updateInvoice already logs generally, but we can add specific log if needed)
        }
        return success;

    } catch (error) {
        console.error("Error adding payment:", error);
        return false;
    }
}

/**
 * Delete an invoice (Soft Delete for preservation)
 */
export async function deleteInvoice(invoiceId) {
    try {
        const role = window.CuteState?.role;
        if (role !== 'admin' && role !== 'moderator') {
            showToast("Permission denied: Only Admins/Moderators can delete invoices", "error");
            return false;
        }

        const invoice = await getInvoice(invoiceId);
        if (!invoice) return false;

        // Use transaction to ensure move-and-delete atomicity
        await runTransaction(db, async (transaction) => {
            const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
            const deletedRef = doc(db, DELETED_INVOICES_COLLECTION, invoiceId);

            // 1. Create copy in deleted_invoices
            transaction.set(deletedRef, {
                ...invoice,
                deletedAt: serverTimestamp(),
                deletedBy: window.CuteState?.user?.uid || "system",
                deletionReason: "Admin User Action"
            });

            // 2. Delete from original collection
            transaction.delete(invoiceRef);
        });

        // 3. Log the action (outside transaction is fine)
        await logInvoiceAction(invoiceId, "deleted", invoice, null, "Invoice moved to Deleted Invoices archive");

        showToast("Invoice deleted (archived)", "success");
        return true;
    } catch (error) {
        console.error("Error deleting invoice:", error);
        showToast(`Failed to delete invoice: ${error.message}`, "error");
        return false;
    }
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(invoiceId) {
    const role = window.CuteState?.role;
    if (role !== 'admin' && role !== 'moderator') {
        showToast("Permission denied", "error");
        return false;
    }
    return updateInvoice(invoiceId, { status: INVOICE_STATUS.CANCELLED });
}

/**
 * Lock/unlock an invoice
 */
export async function setInvoiceLock(invoiceId, lock) {
    const role = window.CuteState?.role;
    if (role !== 'admin' && role !== 'moderator') {
        showToast("Permission denied: Admin/Moderator only", "error");
        return false;
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) return false;

    const previousStatus = invoice.previousStatus || invoice.status;

    if (lock) {
        return updateInvoice(invoiceId, {
            status: INVOICE_STATUS.LOCKED,
            previousStatus: invoice.status
        });
    } else {
        return updateInvoice(invoiceId, {
            status: previousStatus,
            previousStatus: null
        });
    }
}

/**
 * Helper to get Client IP
 */
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn("Failed to fetch IP:", error);
        return "IP_FETCH_FAILED";
    }
}

/**
 * Log an invoice action for audit trail with detailed info
 */
async function logInvoiceAction(invoiceId, action, oldValue, newValue, details = "") {
    try {
        console.log(`[Invoice Logging] Starting log for invoice ${invoiceId}, action: ${action}`);

        // Fetch IP (non-blocking if possible, but we need it for the log)
        const ipAddress = await getClientIP();

        const logEntry = {
            invoiceId,
            action,
            details,
            // User Info
            changedBy: window.CuteState?.user?.uid || "system",
            changedByName: window.CuteState?.userProfile?.name || "System",
            userRole: window.CuteState?.role || "unknown",
            userEmail: window.CuteState?.user?.email || "unknown",
            // Client Info
            ipAddress: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            // Data Snapshots
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null
        };

        console.log(`[Invoice Logging] Log entry prepared:`, {
            invoiceId: logEntry.invoiceId,
            action: logEntry.action,
            user: logEntry.changedByName,
            role: logEntry.userRole
        });

        const docRef = await addDoc(collection(db, INVOICE_LOGS_COLLECTION), logEntry);
        console.log(`[Invoice Logging] ✅ Log created successfully with ID: ${docRef.id}`);

    } catch (error) {
        console.error(`[Invoice Logging] ❌ FAILED to log action "${action}" for invoice ${invoiceId}`);
        console.error("[Invoice Logging] Error details:", error);
        console.error("[Invoice Logging] Error code:", error.code);
        console.error("[Invoice Logging] Error message:", error.message);

        // Show error to user if it's a permission issue
        if (error.code === 'permission-denied') {
            console.error("[Invoice Logging] PERMISSION DENIED - Check Firestore rules for invoiceLogs collection");
            showToast(`Warning: Change saved but history log failed (Permission Denied)`, "warning");
        } else {
            console.error("[Invoice Logging] Unexpected error type:", typeof error);
        }
    }
}

/**
 * Get invoice stats
 */
export async function getInvoiceStats() {
    try {
        const invoices = await getInvoices("all");

        return {
            total: invoices.length,
            draft: invoices.filter(i => i.status === INVOICE_STATUS.DRAFT).length,
            issued: invoices.filter(i => i.status === INVOICE_STATUS.ISSUED).length,
            partiallyPaid: invoices.filter(i => i.status === INVOICE_STATUS.PARTIALLY_PAID).length,
            paid: invoices.filter(i => i.status === INVOICE_STATUS.PAID).length,
            overdue: invoices.filter(i => i.status === INVOICE_STATUS.OVERDUE).length,
            cancelled: invoices.filter(i => i.status === INVOICE_STATUS.CANCELLED).length,
            totalRevenue: invoices.filter(i => i.status === INVOICE_STATUS.PAID).reduce((sum, i) => sum + (i.total || 0), 0),
            totalDue: invoices.reduce((sum, i) => sum + (i.dueAmount || 0), 0)
        };
    } catch (error) {
        console.error("Error getting invoice stats:", error);
        return { total: 0, draft: 0, issued: 0, partiallyPaid: 0, paid: 0, overdue: 0, cancelled: 0, totalRevenue: 0, totalDue: 0 };
    }
}
