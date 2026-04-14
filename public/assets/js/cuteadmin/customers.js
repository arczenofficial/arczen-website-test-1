import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';


const CUSTOMERS_COLLECTION = "customers";

/**
 * Get all customers, optionally filtered by status
 * @param {string} status - "current", "old", or "all"
 * @returns {Promise<Array>} - Array of customer objects
 */
export async function getCustomers(status = "all") {
    try {
        // Fetch all customers for more robust client-side filtering and sorting
        // This avoids issues with case sensitivity in status and missing createdAt fields in Firestore query
        const q = query(collection(db, CUSTOMERS_COLLECTION));
        const snapshot = await getDocs(q);

        let customers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            customers.push({ id: doc.id, ...data });
        });

        // Sort by createdAt desc (newest first)
        customers.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        // Filter by status if specified (case-insensitive)
        if (status !== "all") {
            const targetStatus = status.toLowerCase();
            customers = customers.filter(c => {
                const currentStatus = (c.status || "current").toLowerCase();
                return currentStatus === targetStatus;
            });
        }

        return customers;
    } catch (error) {
        console.error("Error fetching customers:", error);
        return [];
    }
}

/**
 * Get current customers only (for autofill dropdown)
 * @returns {Promise<Array>} - Array of current customer objects
 */
export async function getCurrentCustomers() {
    return getCustomers("current");
}

/**
 * Get a single customer by ID
 * @param {string} customerId - Customer document ID
 * @returns {Promise<Object|null>} - Customer object or null
 */
export async function getCustomer(customerId) {
    try {
        const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching customer:", error);
        return null;
    }
}

/**
 * Create a new customer
 * @param {Object} customerData - Customer data
 * @returns {Promise<string|null>} - New customer ID or null
 */
export async function createCustomer(customerData) {
    try {
        const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), {
            name: customerData.name,
            company: customerData.company || "",
            email: customerData.email || "",
            phone: customerData.phone || "",
            billingAddress: customerData.billingAddress || "",
            siteAddress: customerData.siteAddress || "",
            status: "current", // New customers are always "current"
            notes: customerData.notes || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: window.CuteState?.user?.uid || "system"
        });

        showToast(`Customer "${customerData.name}" created successfully!`, "success");
        return docRef.id;
    } catch (error) {
        console.error("Error creating customer:", error);
        showToast(`Failed to create customer: ${error.message}`, "error");
        return null;
    }
}

/**
 * Update an existing customer
 * @param {string} customerId - Customer document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} - Success status
 */
export async function updateCustomer(customerId, updates) {
    try {
        const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        showToast("Customer updated successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error updating customer:", error);
        showToast(`Failed to update customer: ${error.message}`, "error");
        return false;
    }
}

/**
 * Delete a customer (Admin only)
 * @param {string} customerId - Customer document ID
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCustomer(customerId) {
    try {
        const role = window.CuteState?.role;
        if (role !== 'admin' && role !== 'moderator') {
            showToast("Only admins or moderators can perform this action", "error");
            return false;
        }

        const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        await deleteDoc(docRef);

        showToast("Customer deleted", "success");
        return true;
    } catch (error) {
        console.error("Error deleting customer:", error);
        showToast(`Failed to delete customer: ${error.message}`, "error");
        return false;
    }
}

/**
 * Toggle customer status between "current" and "old"
 * @param {string} customerId - Customer document ID
 * @param {string} newStatus - "current" or "old"
 * @returns {Promise<boolean>} - Success status
 */
export async function setCustomerStatus(customerId, newStatus) {
    return updateCustomer(customerId, { status: newStatus });
}

/**
 * Search customers by name or company
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} - Matching customers
 */
export async function searchCustomers(searchTerm) {
    try {
        // Firestore doesn't support full-text search, so we fetch all and filter client-side
        const allCustomers = await getCustomers("all");
        const term = searchTerm.toLowerCase();

        return allCustomers.filter(c =>
            c.name?.toLowerCase().includes(term) ||
            c.company?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term) ||
            c.phone?.includes(term)
        );
    } catch (error) {
        console.error("Error searching customers:", error);
        return [];
    }
}
