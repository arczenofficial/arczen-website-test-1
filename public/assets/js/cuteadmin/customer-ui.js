// Customer UI Module for IMS
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, setCustomerStatus, searchCustomers } from './customers.js';
import { showToast } from './utils.js';

/**
 * Render the Customers Management Page
 */
export async function renderCustomersPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    const role = window.CuteState?.role;

    content.innerHTML = `
        <div class="ims-page customers-page">
            <div class="page-header-ims">
                <div class="header-left">
                    <h2><i class="material-icons-round">people_alt</i> Customer Management</h2>
                    <p class="subtitle">Manage your clients and their information</p>
                </div>
                <button class="btn-primary-ims" id="addCustomerBtn">
                    <i class="material-icons-round">person_add</i> Add Customer
                </button>
            </div>
            
            <!-- Filters -->
            <div class="filters-bar-ims">
                <div class="filter-group">
                    <label for="customerStatusFilter">Status</label>
                    <select id="customerStatusFilter" class="filter-select-ims">
                        <option value="all">All Customers</option>
                        <option value="current" selected>Current</option>
                        <option value="old">Old / Inactive</option>
                    </select>
                </div>
                <div class="filter-group search-group">
                    <label for="customerSearch">Search</label>
                    <div class="search-input-wrapper">
                        <i class="material-icons-round">search</i>
                        <input type="text" id="customerSearch" placeholder="Search by name, company, email..." class="search-input-ims">
                    </div>
                </div>
                <div class="filter-group reset-group">
                    <label>&nbsp;</label>
                    <button id="resetCustomerFilters" class="btn-secondary-ims" title="Reset filters">
                        <i class="material-icons-round">restart_alt</i> Reset
                    </button>
                </div>
            </div>
            
            <!-- Stats Summary -->
            <div class="stats-bar-ims" id="customerStats">
                <div class="stat-item">
                    <span class="stat-value" id="statTotal">-</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item current">
                    <span class="stat-value" id="statCurrent">-</span>
                    <span class="stat-label">Current</span>
                </div>
                <div class="stat-item old">
                    <span class="stat-value" id="statOld">-</span>
                    <span class="stat-label">Old</span>
                </div>
            </div>
            
            <!-- Customer Grid -->
            <div class="customers-grid" id="customersContainer">
                <div class="initial-loader"><div class="spinner"></div><p>Loading customers...</p></div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('addCustomerBtn')?.addEventListener('click', () => showCustomerModal());
    document.getElementById('customerStatusFilter')?.addEventListener('change', (e) => loadCustomersGrid(e.target.value));

    let searchTimeout;
    document.getElementById('customerSearch')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const status = document.getElementById('customerStatusFilter')?.value || 'all';
            loadCustomersGrid(status, e.target.value);
        }, 300);
    });

    // Reset button
    document.getElementById('resetCustomerFilters')?.addEventListener('click', () => {
        const statusSelect = document.getElementById('customerStatusFilter');
        const searchInput = document.getElementById('customerSearch');

        if (statusSelect) statusSelect.value = 'current';
        if (searchInput) searchInput.value = '';

        loadCustomersGrid('current');
    });

    await loadCustomersGrid('current');
}

/**
 * Load and render the customers grid
 */
async function loadCustomersGrid(status = 'all', searchTerm = '') {
    const container = document.getElementById('customersContainer');
    if (!container) return;

    try {
        let customers;
        if (searchTerm) {
            customers = await searchCustomers(searchTerm);
            if (status !== 'all') {
                customers = customers.filter(c => c.status === status);
            }
        } else {
            customers = await getCustomers(status);
        }

        // Update stats
        const allCustomers = await getCustomers('all');
        document.getElementById('statTotal').textContent = allCustomers.length;
        document.getElementById('statCurrent').textContent = allCustomers.filter(c => c.status === 'current').length;
        document.getElementById('statOld').textContent = allCustomers.filter(c => c.status === 'old').length;

        if (customers.length === 0) {
            container.innerHTML = `
                <div class="empty-state-ims">
                    <i class="material-icons-round">person_off</i>
                    <h3>No Customers Found</h3>
                    <p>${searchTerm ? 'Try a different search term' : 'Add your first customer to get started'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = customers.map(customer => `
            <div class="customer-card ${customer.status}" data-id="${customer.id}">
                <div class="customer-header">
                    <div class="customer-avatar">
                        ${customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div class="customer-info">
                        <h3 class="customer-name">${customer.name}</h3>
                        ${customer.company ? `<span class="customer-company">${customer.company}</span>` : ''}
                    </div>
                    <span class="status-badge-ims ${customer.status}">${customer.status}</span>
                </div>
                
                <div class="customer-details">
                    ${customer.email ? `
                        <div class="detail-row">
                            <i class="material-icons-round">email</i>
                            <a href="mailto:${customer.email}">${customer.email}</a>
                        </div>
                    ` : ''}
                    ${customer.phone ? `
                        <div class="detail-row">
                            <i class="material-icons-round">phone</i>
                            <a href="tel:${customer.phone}">${customer.phone}</a>
                        </div>
                    ` : ''}
                    ${customer.billingAddress ? `
                        <div class="detail-row">
                            <i class="material-icons-round">location_on</i>
                            <span>${customer.billingAddress}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="customer-actions">
                    <button class="btn-icon-ims" onclick="window.editCustomer('${customer.id}')" title="Edit">
                        <i class="material-icons-round">edit</i>
                    </button>
                    <button class="btn-icon-ims" onclick="window.toggleCustomerStatus('${customer.id}', '${customer.status}')" title="${customer.status === 'current' ? 'Mark as Old' : 'Mark as Current'}">
                        <i class="material-icons-round">${customer.status === 'current' ? 'archive' : 'unarchive'}</i>
                    </button>
                    ${window.CuteState?.role === 'admin' ? `
                        <button class="btn-icon-ims danger" onclick="window.confirmDeleteCustomer('${customer.id}', '${customer.name}')" title="Delete">
                            <i class="material-icons-round">delete</i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading customers:", error);
        container.innerHTML = '<p class="error-state">Failed to load customers</p>';
    }
}

/**
 * Show the Add/Edit Customer Modal
 */
/**
 * Show the Add/Edit Customer Modal
 * @param {string|null} customerId - ID to edit, or null for new
 * @param {Function|null} onSuccess - Callback (newId) => {}
 */
export function showCustomerModal(customerId = null, onSuccess = null) {
    const modal = document.createElement('div');
    modal.className = 'modal ims-modal';
    modal.id = 'customerModal';

    const isEdit = !!customerId;

    modal.innerHTML = `
        <div class="modal-content ims-modal-content modern-card" style="max-width: 600px; padding: 0;">
            <div class="card-header-modern" style="padding: 1.5rem; background: #fff; border-bottom: 1px solid #f1f5f9;">
                <div class="icon-box"><i class="material-icons-round">${isEdit ? 'edit' : 'person_add'}</i></div>
                <h2 style="font-size: 1.25rem;">${isEdit ? 'Edit Customer' : 'Add New Customer'}</h2>
                <button class="modal-close" style="margin-left: auto; background: none; border: none; cursor: pointer; color: #64748b;"><i class="material-icons-round">close</i></button>
            </div>
            <form id="customerForm" class="ims-form" style="padding: 1.5rem;">
                <div class="form-row" style="margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="input-group-modern">
                        <label class="modern-label">Customer Name <span class="required">*</span></label>
                        <input type="text" id="customerName" class="modern-input" placeholder="e.g. Mr. Rahman" required>
                    </div>
                    <div class="input-group-modern">
                        <label class="modern-label">Company Name</label>
                        <input type="text" id="customerCompany" class="modern-input" placeholder="e.g. ABC Corporation">
                    </div>
                </div>
                
                <div class="form-row" style="margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="input-group-modern">
                        <label class="modern-label">Email</label>
                        <input type="email" id="customerEmail" class="modern-input" placeholder="customer@example.com">
                    </div>
                    <div class="input-group-modern">
                        <label class="modern-label">Phone</label>
                        <input type="tel" id="customerPhone" class="modern-input" placeholder="+880 1XXX-XXXXXX">
                    </div>
                </div>

                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Billing Address</label>
                    <textarea id="customerBillingAddress" rows="2" class="modern-input" placeholder="Street, City, Postal Code"></textarea>
                </div>

                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Site Address (if different)</label>
                    <textarea id="customerSiteAddress" rows="2" class="modern-input" placeholder="Project site location"></textarea>
                </div>

                <div class="input-group-modern" style="margin-bottom: 1.5rem;">
                    <label class="modern-label">Notes</label>
                    <textarea id="customerNotes" rows="2" class="modern-input" placeholder="Any additional notes..."></textarea>
                </div>

                <div class="modal-actions ims-modal-actions" style="border-top: 1px solid #f1f5f9; padding-top: 1.5rem; margin-top: 0;">
                    <button type="button" class="btn-secondary-ims modal-close">Cancel</button>
                    <button type="submit" class="btn-primary-ims">${isEdit ? 'Update Customer' : 'Add Customer'}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Load existing data if editing
    if (isEdit) {
        loadCustomerData(customerId);
    }

    // Form submit
    document.getElementById('customerForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            name: document.getElementById('customerName').value.trim(),
            company: document.getElementById('customerCompany').value.trim(),
            email: document.getElementById('customerEmail').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            billingAddress: document.getElementById('customerBillingAddress').value.trim(),
            siteAddress: document.getElementById('customerSiteAddress').value.trim(),
            notes: document.getElementById('customerNotes').value.trim()
        };

        if (!data.name) {
            showToast("Customer name is required", "error");
            return;
        }

        let success;
        let newId = customerId;
        if (isEdit) {
            success = await updateCustomer(customerId, data);
        } else {
            newId = await createCustomer(data);
            success = !!newId;
        }

        if (success) {
            modal.remove();
            // Refresh grid if on customers page
            if (document.getElementById('customersContainer')) {
                const status = document.getElementById('customerStatusFilter')?.value || 'current';
                await loadCustomersGrid(status);
            }
            // Trigger callback if provided
            if (onSuccess) onSuccess(newId);
        }
    });
}

/**
 * Load customer data into the edit form
 */
async function loadCustomerData(customerId) {
    const customer = await getCustomer(customerId);
    if (!customer) {
        showToast("Customer not found", "error");
        document.getElementById('customerModal')?.remove();
        return;
    }

    document.getElementById('customerName').value = customer.name || '';
    document.getElementById('customerCompany').value = customer.company || '';
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerPhone').value = customer.phone || '';
    document.getElementById('customerBillingAddress').value = customer.billingAddress || '';
    document.getElementById('customerSiteAddress').value = customer.siteAddress || '';
    document.getElementById('customerNotes').value = customer.notes || '';
}

// Global functions for onclick handlers
window.editCustomer = function (customerId) {
    showCustomerModal(customerId);
};

window.toggleCustomerStatus = async function (customerId, currentStatus) {
    const newStatus = currentStatus === 'current' ? 'old' : 'current';
    const success = await setCustomerStatus(customerId, newStatus);
    if (success) {
        const filterStatus = document.getElementById('customerStatusFilter')?.value || 'all';
        await loadCustomersGrid(filterStatus);
    }
};

window.confirmDeleteCustomer = async function (customerId, customerName) {
    if (confirm(`Are you sure you want to delete customer "${customerName}"? This cannot be undone.`)) {
        const success = await deleteCustomer(customerId);
        if (success) {
            const filterStatus = document.getElementById('customerStatusFilter')?.value || 'all';
            await loadCustomersGrid(filterStatus);
        }
    }
};

/**
 * Customer Dropdown for Invoice Creation
 * Returns HTML for a searchable customer select
 */
export async function getCustomerDropdownHTML(selectedId = null) {
    const customers = await getCustomers('current');

    return `
        <div class="customer-select-wrapper">
            <select id="invoiceCustomer" class="customer-select-ims" required>
                <option value="">Select a customer...</option>
                ${customers.map(c => `
                    <option value="${c.id}" ${selectedId === c.id ? 'selected' : ''} 
                        data-name="${c.name}" 
                        data-company="${c.company || ''}" 
                        data-email="${c.email || ''}"
                        data-phone="${c.phone || ''}"
                        data-address="${c.billingAddress || ''}">
                        ${c.name}${c.company ? ` (${c.company})` : ''}
                    </option>
                `).join('')}
            </select>
            <button type="button" class="btn-icon-ims" onclick="window.quickAddCustomer()" title="Quick Add Customer">
                <i class="material-icons-round">person_add</i>
            </button>
        </div>
    `;
}

/**
 * Quick Add Customer from Invoice Form
 */
window.quickAddCustomer = function () {
    showCustomerModal();
};
