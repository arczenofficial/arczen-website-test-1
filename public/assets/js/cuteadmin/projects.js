// Projects Management Module - Reusable across IMS, Tasks, etc.
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
const PROJECTS_COLLECTION = "projects";

// Project status constants
export const PROJECT_STATUS = {
    PLANNING: "planning",
    IN_PROGRESS: "in_progress",
    ON_HOLD: "on_hold",
    COMPLETED: "completed",
    CANCELLED: "cancelled"
};

/**
 * Get all projects, optionally filtered by status
 * @param {string} status - Project status or "all"
 * @returns {Promise<Array>} - Array of project objects
 */
export async function getProjects(status = "all") {
    try {
        // Fetch all projects for more robust client-side filtering and sorting
        const q = query(collection(db, PROJECTS_COLLECTION));
        const snapshot = await getDocs(q);

        let projects = [];
        snapshot.forEach((doc) => {
            projects.push({ id: doc.id, ...doc.data() });
        });

        // Sort by createdAt desc
        projects.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        // Filter by status if specified
        if (status !== "all") {
            const targetStatus = status.toLowerCase();
            projects = projects.filter(p => (p.status || "").toLowerCase() === targetStatus);
        }

        return projects;
    } catch (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
}

/**
 * Get active projects (for dropdowns)
 * @returns {Promise<Array>}
 */
export async function getActiveProjects() {
    try {
        const allProjects = await getProjects("all");
        const activeStatuses = [PROJECT_STATUS.PLANNING, PROJECT_STATUS.IN_PROGRESS];

        return allProjects.filter(p => activeStatuses.includes(p.status));
    } catch (error) {
        console.error("Error fetching active projects:", error);
        return [];
    }
}

/**
 * Get a single project by ID
 * @param {string} projectId - Project document ID
 * @returns {Promise<Object|null>}
 */
export async function getProject(projectId) {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching project:", error);
        return null;
    }
}

/**
 * Create a new project
 * @param {Object} projectData - Project data
 * @returns {Promise<string|null>} - New project ID or null
 */
export async function createProject(projectData) {
    try {
        const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
            name: projectData.name,
            description: projectData.description || "",
            customerId: projectData.customerId || null,
            customerName: projectData.customerName || "",
            location: projectData.location || "",
            status: projectData.status || PROJECT_STATUS.PLANNING,
            startDate: projectData.startDate || null,
            endDate: projectData.endDate || null,
            budget: projectData.budget || 0,
            notes: projectData.notes || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: window.CuteState?.user?.uid || "system"
        });

        showToast(`Project "${projectData.name}" created!`, "success");
        return docRef.id;
    } catch (error) {
        console.error("Error creating project:", error);
        showToast(`Failed to create project: ${error.message}`, "error");
        return null;
    }
}

/**
 * Update an existing project
 * @param {string} projectId - Project document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>}
 */
export async function updateProject(projectId, updates) {
    try {
        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });

        showToast("Project updated", "success");
        return true;
    } catch (error) {
        console.error("Error updating project:", error);
        showToast(`Failed to update project: ${error.message}`, "error");
        return false;
    }
}

/**
 * Delete a project (Admin only)
 * @param {string} projectId - Project document ID
 * @returns {Promise<boolean>}
 */
export async function deleteProject(projectId) {
    try {
        const role = window.CuteState?.role;
        if (role !== 'admin' && role !== 'moderator') {
            showToast("Only admins or moderators can manage projects", "error");
            return false;
        }

        const docRef = doc(db, PROJECTS_COLLECTION, projectId);
        await deleteDoc(docRef);

        showToast("Project deleted", "success");
        return true;
    } catch (error) {
        console.error("Error deleting project:", error);
        showToast(`Failed to delete project: ${error.message}`, "error");
        return false;
    }
}

/**
 * Get project dropdown HTML for reuse in invoices, tasks, etc.
 * @param {string} selectedId - Currently selected project ID
 * @param {string} elementId - ID for the select element
 * @returns {Promise<string>} - HTML string
 */
export async function getProjectDropdownHTML(selectedId = null, elementId = 'projectSelect') {
    const projects = await getActiveProjects();

    return `
        <select id="${elementId}" class="project-select-ims">
            <option value="">No project / Standalone</option>
            ${projects.map(p => `
                <option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>
                    ${p.name}${p.customerName ? ` (${p.customerName})` : ''}
                </option>
            `).join('')}
        </select>
    `;
}

/**
 * Show quick project creation modal (reusable)
 * @param {Function} onSuccess - Callback with new project ID
 * @param {string} preselectedCustomerId - Optional customer to pre-select
 */
export async function showQuickProjectModal(onSuccess = null, preselectedCustomerId = null) {
    const { getCurrentCustomers } = await import('./customers.js');
    const customers = await getCurrentCustomers();

    const modal = document.createElement('div');
    modal.className = 'modal ims-modal project-modal';
    modal.innerHTML = `
        <div class="modal-content ims-modal-content" style="max-width: 550px;">
            <div class="modal-header ims-modal-header">
                <h2><i class="material-icons-round">work</i> Create Project</h2>
                <button class="modal-close">&times;</button>
            </div>
            <form id="quickProjectForm" class="ims-form">
                <div class="input-group-ims">
                    <label>Project Name <span class="required">*</span></label>
                    <input type="text" id="projectName" placeholder="e.g. Gulshan Apartment Renovation" required>
                </div>
                <div class="input-group-ims">
                    <label>Customer</label>
                    <select id="projectCustomer">
                        <option value="">No customer assigned</option>
                        ${customers.map(c => `
                            <option value="${c.id}" data-name="${c.name}" ${preselectedCustomerId === c.id ? 'selected' : ''}>
                                ${c.name}${c.company ? ` (${c.company})` : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="input-group-ims">
                        <label>Status</label>
                        <select id="projectStatus">
                            <option value="planning">📋 Planning</option>
                            <option value="in_progress">🚧 In Progress</option>
                            <option value="on_hold">⏸️ On Hold</option>
                        </select>
                    </div>
                    <div class="input-group-ims">
                        <label>Budget (৳)</label>
                        <input type="number" id="projectBudget" placeholder="0" min="0">
                    </div>
                </div>
                <div class="input-group-ims">
                    <label>Location</label>
                    <input type="text" id="projectLocation" placeholder="e.g. Gulshan-2, Dhaka">
                </div>
                <div class="input-group-ims">
                    <label>Description</label>
                    <textarea id="projectDescription" rows="2" placeholder="Brief project description..."></textarea>
                </div>
                <div class="modal-actions ims-modal-actions">
                    <button type="button" class="btn-secondary modal-close">Cancel</button>
                    <button type="submit" class="btn-primary-ims">
                        <i class="material-icons-round">add</i> Create Project
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Form submit
    document.getElementById('quickProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const customerSelect = document.getElementById('projectCustomer');
        const selectedOption = customerSelect.options[customerSelect.selectedIndex];

        const projectData = {
            name: document.getElementById('projectName').value.trim(),
            customerId: customerSelect.value || null,
            customerName: selectedOption?.dataset?.name || "",
            status: document.getElementById('projectStatus').value,
            budget: parseFloat(document.getElementById('projectBudget').value) || 0,
            location: document.getElementById('projectLocation').value.trim(),
            description: document.getElementById('projectDescription').value.trim()
        };

        if (!projectData.name) {
            showToast("Project name is required", "error");
            return;
        }

        const newId = await createProject(projectData);
        if (newId) {
            modal.remove();
            if (onSuccess) onSuccess(newId, projectData.name);
        }
    });
}

// Make functions available globally for reuse
window.showQuickProjectModal = showQuickProjectModal;
window.getProjectDropdownHTML = getProjectDropdownHTML;
