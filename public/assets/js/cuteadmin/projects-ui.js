// Projects UI Module
import { getProjects, getProject, createProject, updateProject, deleteProject, PROJECT_STATUS, showQuickProjectModal } from './projects.js';
import { getCurrentCustomers } from './customers.js';
import { showToast } from './utils.js';

/**
 * Render the Projects Management Page
 */
export async function renderProjectsPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    const role = window.CuteState?.role;

    content.innerHTML = `
        <div class="ims-page projects-page">
            <div class="page-header-ims">
                <div class="header-left">
                    <h2><i class="material-icons-round">work</i> Project Management</h2>
                    <p class="subtitle">Manage projects, link invoices and tasks</p>
                </div>
                <button class="btn-primary-ims" id="createProjectBtn">
                    <i class="material-icons-round">add</i> New Project
                </button>
            </div>
            
            <!-- Stats Cards -->
            <div class="project-stats-grid" id="projectStatsGrid">
                <div class="stat-card planning">
                    <i class="material-icons-round">assignment</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statPlanning">-</span>
                        <span class="stat-label">Planning</span>
                    </div>
                </div>
                <div class="stat-card in-progress">
                    <i class="material-icons-round">engineering</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statInProgress">-</span>
                        <span class="stat-label">In Progress</span>
                    </div>
                </div>
                <div class="stat-card on-hold">
                    <i class="material-icons-round">pause_circle</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statOnHold">-</span>
                        <span class="stat-label">On Hold</span>
                    </div>
                </div>
                <div class="stat-card completed">
                    <i class="material-icons-round">check_circle</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statCompleted">-</span>
                        <span class="stat-label">Completed</span>
                    </div>
                </div>
            </div>
            
            <!-- Filters -->
            <div class="filters-bar-ims">
                <div class="filter-group">
                    <label for="projectStatusFilter">Status</label>
                    <select id="projectStatusFilter" class="filter-select-ims">
                        <option value="all">All Projects</option>
                        <option value="planning">Planning</option>
                        <option value="in_progress" selected>In Progress</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="filter-group search-group">
                    <label for="projectSearch">Search</label>
                    <div class="search-input-wrapper">
                        <i class="material-icons-round">search</i>
                        <input type="text" id="projectSearch" placeholder="Search by name, customer, location..." class="search-input-ims">
                    </div>
                </div>
            </div>
            
            <!-- Projects Grid -->
            <div class="projects-grid" id="projectsContainer">
                <div class="initial-loader"><div class="spinner"></div><p>Loading projects...</p></div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('createProjectBtn')?.addEventListener('click', () => showProjectModal());
    document.getElementById('projectStatusFilter')?.addEventListener('change', (e) => loadProjectsGrid(e.target.value));

    let searchTimeout;
    document.getElementById('projectSearch')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const status = document.getElementById('projectStatusFilter')?.value || 'all';
            loadProjectsGrid(status, e.target.value);
        }, 300);
    });

    await loadProjectStats();
    await loadProjectsGrid('in_progress');
}

/**
 * Load project statistics
 */
async function loadProjectStats() {
    const projects = await getProjects('all');

    document.getElementById('statPlanning').textContent = projects.filter(p => p.status === PROJECT_STATUS.PLANNING).length;
    document.getElementById('statInProgress').textContent = projects.filter(p => p.status === PROJECT_STATUS.IN_PROGRESS).length;
    document.getElementById('statOnHold').textContent = projects.filter(p => p.status === PROJECT_STATUS.ON_HOLD).length;
    document.getElementById('statCompleted').textContent = projects.filter(p => p.status === PROJECT_STATUS.COMPLETED).length;
}

/**
 * Load and render the projects grid
 */
async function loadProjectsGrid(status = 'all', searchTerm = '') {
    const container = document.getElementById('projectsContainer');
    if (!container) return;

    try {
        let projects = await getProjects(status);

        // Client-side search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            projects = projects.filter(p =>
                p.name?.toLowerCase().includes(term) ||
                p.customerName?.toLowerCase().includes(term) ||
                p.location?.toLowerCase().includes(term)
            );
        }

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state-ims">
                    <i class="material-icons-round">work_off</i>
                    <h3>No Projects Found</h3>
                    <p>${searchTerm ? 'Try a different search term' : 'Create your first project to get started'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => `
            <div class="project-card ${project.status}" data-id="${project.id}">
                <div class="project-header">
                    <div class="project-icon">
                        <i class="material-icons-round">${getStatusIcon(project.status)}</i>
                    </div>
                    <div class="project-info">
                        <h3 class="project-name">${project.name}</h3>
                        ${project.customerName ? `<span class="project-customer">${project.customerName}</span>` : ''}
                    </div>
                    <span class="status-badge-ims ${project.status}">${formatStatus(project.status)}</span>
                </div>
                
                <div class="project-details">
                    ${project.location ? `
                        <div class="detail-row">
                            <i class="material-icons-round">location_on</i>
                            <span>${project.location}</span>
                        </div>
                    ` : ''}
                    ${project.budget ? `
                        <div class="detail-row">
                            <i class="material-icons-round">payments</i>
                            <span>৳${project.budget.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${project.description ? `
                        <p class="project-desc">${project.description}</p>
                    ` : ''}
                </div>
                
                <div class="project-actions">
                    <button class="btn-icon-ims" onclick="window.editProject('${project.id}')" title="Edit">
                        <i class="material-icons-round">edit</i>
                    </button>
                    <button class="btn-icon-ims" onclick="window.viewProjectInvoices('${project.id}')" title="View Invoices">
                        <i class="material-icons-round">receipt_long</i>
                    </button>
                    ${window.CuteState?.role === 'admin' ? `
                        <button class="btn-icon-ims danger" onclick="window.confirmDeleteProject('${project.id}', '${project.name}')" title="Delete">
                            <i class="material-icons-round">delete</i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading projects:", error);
        container.innerHTML = '<p class="error-state">Failed to load projects</p>';
    }
}

function getStatusIcon(status) {
    const icons = {
        'planning': 'assignment',
        'in_progress': 'engineering',
        'on_hold': 'pause_circle',
        'completed': 'check_circle',
        'cancelled': 'cancel'
    };
    return icons[status] || 'work';
}

function formatStatus(status) {
    const statusMap = {
        'planning': 'Planning',
        'in_progress': 'In Progress',
        'on_hold': 'On Hold',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

/**
 * Show the Add/Edit Project Modal
 */
async function showProjectModal(projectId = null) {
    const isEdit = !!projectId;
    let project = null;

    if (isEdit) {
        project = await getProject(projectId);
        if (!project) {
            showToast("Project not found", "error");
            return;
        }
    }

    const customers = await getCurrentCustomers();

    const modal = document.createElement('div');
    modal.className = 'modal ims-modal project-modal';
    modal.id = 'projectModal';

    modal.innerHTML = `
        <div class="modal-content ims-modal-content modern-card" style="max-width: 650px; padding: 0;">
            <div class="card-header-modern" style="padding: 1.5rem; background: #fff; border-bottom: 1px solid #f1f5f9;">
                <div class="icon-box"><i class="material-icons-round">${isEdit ? 'edit' : 'work'}</i></div>
                <h2 style="font-size: 1.25rem;">${isEdit ? 'Edit Project' : 'Create New Project'}</h2>
                <button class="modal-close" style="margin-left: auto; background: none; border: none; cursor: pointer; color: #64748b;"><i class="material-icons-round">close</i></button>
            </div>
            <form id="projectForm" class="ims-form" style="padding: 1.5rem;">
                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Project Name <span class="required">*</span></label>
                    <input type="text" id="projectName" value="${project?.name || ''}" class="modern-input" placeholder="e.g. Gulshan Apartment Renovation" required>
                </div>

                <div class="form-row" style="margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="input-group-modern">
                        <label class="modern-label">Customer</label>
                        <select id="projectCustomer" class="modern-select" style="width: 100%;">
                            <option value="">No customer assigned</option>
                            ${customers.map(c => `
                                <option value="${c.id}" data-name="${c.name}" ${project?.customerId === c.id ? 'selected' : ''}>
                                    ${c.name}${c.company ? ` (${c.company})` : ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="input-group-modern">
                        <label class="modern-label">Status</label>
                        <select id="projectStatus" class="modern-select" style="width: 100%;">
                            <option value="planning" ${project?.status === 'planning' ? 'selected' : ''}>📋 Planning</option>
                            <option value="in_progress" ${project?.status === 'in_progress' ? 'selected' : ''}>🚧 In Progress</option>
                            <option value="on_hold" ${project?.status === 'on_hold' ? 'selected' : ''}>⏸️ On Hold</option>
                            <option value="completed" ${project?.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                            <option value="cancelled" ${project?.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
                        </select>
                    </div>
                </div>

                <div class="form-row" style="margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="input-group-modern">
                        <label class="modern-label">Location</label>
                        <input type="text" id="projectLocation" class="modern-input" value="${project?.location || ''}" placeholder="e.g. Gulshan-2, Dhaka">
                    </div>
                    <div class="input-group-modern">
                        <label class="modern-label">Budget (৳)</label>
                        <input type="number" id="projectBudget" class="modern-input" value="${project?.budget || ''}" placeholder="0" min="0">
                    </div>
                </div>

                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Description</label>
                    <textarea id="projectDescription" rows="3" class="modern-input" placeholder="Brief project description...">${project?.description || ''}</textarea>
                </div>

                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Notes</label>
                    <textarea id="projectNotes" rows="2" class="modern-input" placeholder="Internal notes...">${project?.notes || ''}</textarea>
                </div>

                <div class="modal-actions ims-modal-actions" style="border-top: 1px solid #f1f5f9; padding-top: 1.5rem; margin-top: 0;">
                    <button type="button" class="btn-secondary-ims modal-close">Cancel</button>
                    <button type="submit" class="btn-primary-ims">${isEdit ? 'Update Project' : 'Create Project'}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Form submit
    document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const customerSelect = document.getElementById('projectCustomer');
        const selectedOption = customerSelect.options[customerSelect.selectedIndex];

        const data = {
            name: document.getElementById('projectName').value.trim(),
            customerId: customerSelect.value || null,
            customerName: selectedOption?.dataset?.name || "",
            status: document.getElementById('projectStatus').value,
            location: document.getElementById('projectLocation').value.trim(),
            budget: parseFloat(document.getElementById('projectBudget').value) || 0,
            description: document.getElementById('projectDescription').value.trim(),
            notes: document.getElementById('projectNotes').value.trim()
        };

        if (!data.name) {
            showToast("Project name is required", "error");
            return;
        }

        let success;
        if (isEdit) {
            success = await updateProject(projectId, data);
        } else {
            success = await createProject(data);
        }

        if (success) {
            modal.remove();
            await loadProjectStats();
            await loadProjectsGrid(document.getElementById('projectStatusFilter')?.value || 'all');
        }
    });
}

// Global functions
window.editProject = function (projectId) {
    showProjectModal(projectId);
};

window.viewProjectInvoices = async function (projectId) {
    // Navigate to invoices filtered by project
    window.location.hash = '#invoices';
    showToast("Project invoice filtering coming soon!", "neutral");
};

window.confirmDeleteProject = async function (projectId, projectName) {
    if (confirm(`Delete project "${projectName}"? This cannot be undone.`)) {
        const success = await deleteProject(projectId);
        if (success) {
            await loadProjectStats();
            await loadProjectsGrid(document.getElementById('projectStatusFilter')?.value || 'all');
        }
    }
};
