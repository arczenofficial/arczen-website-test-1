// Invoice UI Module for IMS
import { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, issueInvoice, addPayment, getInvoiceStats, getExportedInvoices, INVOICE_STATUS } from './invoices.js';
import { getCustomer, getCurrentCustomers } from './customers.js';
import { showToast } from './utils.js';
// Import PDF module to make download functions available globally
import './invoice-pdf.js';

/**
 * Render the Invoices Management Page
 */
export async function renderInvoicesPage() {
    window.renderInvoicesPage = renderInvoicesPage; // Ensure it's globally available for back buttons
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    const role = window.CuteState?.role;

    content.innerHTML = `
        <div class="ims-page invoices-page">
            <div class="page-header-ims">
                <div class="header-left">
                    <h2><i class="material-icons-round">receipt_long</i> Invoice Management</h2>
                    <p class="subtitle">Create, manage, and track invoices</p>
                </div>
                <div class="header-actions" style="display: flex; gap: 10px;">
                    <button class="btn-secondary-ims" id="viewExportLogBtn">
                        <i class="material-icons-round">history</i> Export Log
                    </button>
                    <button class="btn-primary-ims" id="createInvoiceBtn">
                        <i class="material-icons-round">add</i> New Invoice
                    </button>
                </div>
            </div>
            
            <!-- Stats Cards -->
            <div class="invoice-stats-grid" id="invoiceStatsGrid">
                <div class="stat-card draft">
                    <i class="material-icons-round">edit_note</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statDraft">-</span>
                        <span class="stat-label">Drafts</span>
                    </div>
                </div>
                <div class="stat-card issued">
                    <i class="material-icons-round">send</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statIssued">-</span>
                        <span class="stat-label">Issued</span>
                    </div>
                </div>
                <div class="stat-card partial">
                    <i class="material-icons-round">hourglass_top</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statPartial">-</span>
                        <span class="stat-label">Partial</span>
                    </div>
                </div>
                <div class="stat-card paid">
                    <i class="material-icons-round">check_circle</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statPaid">-</span>
                        <span class="stat-label">Paid</span>
                    </div>
                </div>
                <div class="stat-card revenue">
                    <i class="material-icons-round">payments</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statRevenue">-</span>
                        <span class="stat-label">Revenue</span>
                    </div>
                </div>
                <div class="stat-card due">
                    <i class="material-icons-round">account_balance_wallet</i>
                    <div class="stat-content">
                        <span class="stat-value" id="statDue">-</span>
                        <span class="stat-label">Total Due</span>
                    </div>
                </div>
            </div>
            
            <!-- Filters -->
            <div class="filters-bar-ims" style="flex-wrap: wrap;">
                <div class="filter-group">
                    <label for="invoiceStatusFilter">Status</label>
                    <select id="invoiceStatusFilter" class="filter-select-ims">
                        <option value="all">All Invoices</option>
                        <option value="draft">Drafts</option>
                        <option value="issued">Issued</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="invoiceCustomerFilter">Customer</label>
                    <select id="invoiceCustomerFilter" class="filter-select-ims">
                        <option value="all">All Customers</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="invoiceDateFrom">From Date</label>
                    <input type="date" id="invoiceDateFrom" class="filter-input-ims">
                </div>
                <div class="filter-group">
                    <label for="invoiceDateTo">To Date</label>
                    <input type="date" id="invoiceDateTo" class="filter-input-ims">
                </div>
                <div class="filter-group">
                    <label>Quick</label>
                    <select id="invoicePeriodFilter" class="filter-select-ims">
                        <option value="">Custom</option>
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="last_month">Last Month</option>
                        <option value="this_year">This Year</option>
                    </select>
                </div>
                <div class="filter-group search-group">
                    <label for="invoiceSearch">Search</label>
                    <div class="search-input-wrapper">
                        <i class="material-icons-round">search</i>
                        <input type="text" id="invoiceSearch" placeholder="Search by invoice #, customer..." class="search-input-ims">
                    </div>
                </div>
                <div class="filter-group reset-group">
                    <label>&nbsp;</label>
                    <button id="resetInvoiceFilters" class="btn-secondary-ims" title="Reset all filters">
                        <i class="material-icons-round">restart_alt</i> Reset
                    </button>
                </div>
            </div>
            
            <!-- Invoices Table -->
            <div class="invoices-table-wrapper">
                <table class="invoices-table" id="invoicesTable">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Due Date</th>
                            <th>Total</th>
                            <th>Paid</th>
                            <th>Due</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="invoicesBody">
                        <tr><td colspan="9" class="loading-row"><div class="spinner"></div> Loading invoices...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('createInvoiceBtn')?.addEventListener('click', () => showInvoiceEditor());
    document.getElementById('viewExportLogBtn')?.addEventListener('click', () => showExportLogPage());

    // All filter change triggers reload
    const applyFilters = () => {
        const status = document.getElementById('invoiceStatusFilter')?.value || 'all';
        const search = document.getElementById('invoiceSearch')?.value || '';
        const customerId = document.getElementById('invoiceCustomerFilter')?.value || 'all';
        const dateFrom = document.getElementById('invoiceDateFrom')?.value || '';
        const dateTo = document.getElementById('invoiceDateTo')?.value || '';
        loadInvoicesTable(status, search, { customerId, dateFrom, dateTo });
    };

    document.getElementById('invoiceStatusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('invoiceCustomerFilter')?.addEventListener('change', applyFilters);
    document.getElementById('invoiceDateFrom')?.addEventListener('change', applyFilters);
    document.getElementById('invoiceDateTo')?.addEventListener('change', applyFilters);

    // Reset button
    document.getElementById('resetInvoiceFilters')?.addEventListener('click', () => {
        const statusSelect = document.getElementById('invoiceStatusFilter');
        const customerSelect = document.getElementById('invoiceCustomerFilter');
        const dateFromInput = document.getElementById('invoiceDateFrom');
        const dateToInput = document.getElementById('invoiceDateTo');
        const periodSelect = document.getElementById('invoicePeriodFilter');
        const searchInput = document.getElementById('invoiceSearch');

        if (statusSelect) statusSelect.value = 'all';
        if (customerSelect) customerSelect.value = 'all';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        if (periodSelect) periodSelect.value = '';
        if (searchInput) searchInput.value = '';

        applyFilters();
    });

    // Period quick-select
    document.getElementById('invoicePeriodFilter')?.addEventListener('change', (e) => {
        const period = e.target.value;
        const now = new Date();
        let from = '', to = '';

        if (period === 'today') {
            from = to = now.toISOString().split('T')[0];
        } else if (period === 'this_week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            from = startOfWeek.toISOString().split('T')[0];
            to = now.toISOString().split('T')[0];
        } else if (period === 'this_month') {
            from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            to = now.toISOString().split('T')[0];
        } else if (period === 'last_month') {
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
            to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        } else if (period === 'this_year') {
            from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            to = now.toISOString().split('T')[0];
        }

        document.getElementById('invoiceDateFrom').value = from;
        document.getElementById('invoiceDateTo').value = to;
        applyFilters();
    });

    let searchTimeout;
    document.getElementById('invoiceSearch')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    // Load customer dropdown
    (async () => {
        const { getCurrentCustomers } = await import('./customers.js');
        const customers = await getCurrentCustomers();
        const customerSelect = document.getElementById('invoiceCustomerFilter');
        if (customerSelect) {
            customerSelect.innerHTML = `
                <option value="all">All Customers</option>
                ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            `;
        }
    })();

    await loadInvoiceStats();
    await loadInvoicesTable('all');
}

/**
 * Load invoice statistics
 */
async function loadInvoiceStats() {
    const stats = await getInvoiceStats();

    document.getElementById('statDraft').textContent = stats.draft;
    document.getElementById('statIssued').textContent = stats.issued;
    document.getElementById('statPartial').textContent = stats.partiallyPaid;
    document.getElementById('statPaid').textContent = stats.paid;
    document.getElementById('statRevenue').textContent = formatCurrency(stats.totalRevenue);
    document.getElementById('statDue').textContent = formatCurrency(stats.totalDue);
}

/**
 * Load and render the invoices table
 */
async function loadInvoicesTable(status = 'all', searchTerm = '', filters = {}) {
    const tbody = document.getElementById('invoicesBody');
    if (!tbody) return;

    try {
        let invoices = await getInvoices(status);

        // Client-side search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            invoices = invoices.filter(inv =>
                inv.invoiceNumber?.toLowerCase().includes(term) ||
                inv.customerSnapshot?.name?.toLowerCase().includes(term)
            );
        }

        // Customer filter
        if (filters.customerId && filters.customerId !== 'all') {
            invoices = invoices.filter(inv => inv.customerId === filters.customerId);
        }

        // Date range filter
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            invoices = invoices.filter(inv => {
                const invDate = new Date(inv.date);
                return invDate >= fromDate;
            });
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            invoices = invoices.filter(inv => {
                const invDate = new Date(inv.date);
                return invDate <= toDate;
            });
        }

        if (invoices.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-row">
                        <div class="empty-state-ims">
                            <i class="material-icons-round">receipt</i>
                            <h3>No Invoices Found</h3>
                            <p>Create your first invoice to get started</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = invoices.map(inv => `
            <tr class="invoice-row ${inv.status}" data-id="${inv.id}">
                <td class="invoice-number">
                    <a href="#" onclick="window.viewInvoice('${inv.id}'); return false;">${inv.invoiceNumber}</a>
                </td>
                <td class="customer-name">${inv.customerSnapshot?.name || '<em>No customer</em>'}</td>
                <td class="date">${formatDate(inv.date)}</td>
                <td class="due-date">${inv.dueDate ? formatDate(inv.dueDate) : '-'}</td>
                <td class="total">${formatCurrency(inv.total)}</td>
                <td class="paid">${formatCurrency(inv.totalPaid)}</td>
                <td class="due ${inv.dueAmount > 0 ? 'has-due' : ''}">${formatCurrency(inv.dueAmount)}</td>
                <td><span class="status-badge-ims ${inv.status}">${formatStatus(inv.status)}</span></td>
                <td class="actions">
                    ${getActionsColumnHtml(inv)}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error("Error loading invoices:", error);
        tbody.innerHTML = '<tr><td colspan="9" class="error-row">Failed to load invoices. Please check console.</td></tr>';
    }
}

/**
 * Generate HTML for the actions column based on permissions
 */
function getActionsColumnHtml(inv) {
    const role = window.CuteState?.role;
    const isAdmin = role === 'admin' || role === 'moderator';

    let html = `
        <div class="action-buttons">
            <button class="btn-icon-ims" onclick="window.viewInvoice('${inv.id}')" title="Preview">
                <i class="material-icons-round">visibility</i>
            </button>
            <button class="btn-icon-ims" onclick="window.downloadInvoicePDF('${inv.id}')" title="Download PDF">
                <i class="material-icons-round">download</i>
            </button>
    `;

    // ADMIN ONLY ACTIONS
    if (isAdmin) {
        // Edit & Issue (Drafts)
        if (inv.status === INVOICE_STATUS.DRAFT) {
            html += `
                <button class="btn-icon-ims" onclick="window.editInvoice('${inv.id}')" title="Edit">
                    <i class="material-icons-round">edit</i>
                </button>
                <button class="btn-icon-ims success" onclick="window.issueInvoiceAction('${inv.id}')" title="Issue">
                    <i class="material-icons-round">send</i>
                </button>
            `;
        }

        // Payments
        if (inv.status !== INVOICE_STATUS.DRAFT && inv.status !== INVOICE_STATUS.PAID && inv.status !== INVOICE_STATUS.CANCELLED) {
            html += `
                <button class="btn-icon-ims" onclick="window.showPaymentModal('${inv.id}')" title="Add Payment">
                    <i class="material-icons-round">payments</i>
                </button>
            `;
        }

        // History
        html += `
            <button class="btn-icon-ims" onclick="window.showInvoiceHistoryModal('${inv.id}', '${inv.invoiceNumber}')" title="View History">
                <i class="material-icons-round">history</i>
            </button>
        `;

        // Lock/Unlock
        if (inv.status !== INVOICE_STATUS.LOCKED) {
            html += `
                <button class="btn-icon-ims" onclick="window.lockInvoiceAction('${inv.id}', true)" title="Lock Invoice">
                    <i class="material-icons-round">lock</i>
                </button>
            `;
        } else {
            html += `
                <button class="btn-icon-ims success" onclick="window.lockInvoiceAction('${inv.id}', false)" title="Unlock Invoice">
                    <i class="material-icons-round">lock_open</i>
                </button>
            `;
        }

        // Cancel
        if (inv.status !== INVOICE_STATUS.CANCELLED && inv.status !== INVOICE_STATUS.DRAFT) {
            html += `
                <button class="btn-icon-ims danger" onclick="window.cancelInvoiceAction('${inv.id}')" title="Cancel Invoice">
                    <i class="material-icons-round">block</i>
                </button>
            `;
        }

        // Delete
        html += `
            <button class="btn-icon-ims danger" onclick="window.deleteInvoiceAction('${inv.id}')" title="Delete">
                <i class="material-icons-round">delete</i>
            </button>
        `;
    }

    // CLONE (Available to all)
    html += `
            <button class="btn-icon-ims" onclick="window.cloneInvoice('${inv.id}')" title="Clone">
                <i class="material-icons-round">content_copy</i>
            </button>
        </div>
    `;

    return html;
}





/**
 * Show the Invoice Editor (Create/Edit) - Full Page View
 */
export function showInvoiceEditor(invoiceId = null) {
    const isEdit = !!invoiceId;
    const today = new Date().toISOString().split('T')[0];

    // Get the main content area and render IMMEDIATELY
    const mainContent = document.getElementById('mainContentArea');
    if (!mainContent) {
        console.error("Main content area not found");
        return;
    }

    // Render the page instantly with loading state for dropdown
    mainContent.innerHTML = `
        <div class="ims-page invoice-editor-page fixed-layout">
            <!-- Fixed Header -->
            <div class="page-header-ims fixed-header">
                <div class="header-left">
                    <button class="btn-back" onclick="window.cancelInvoiceEditor()">
                        <i class="material-icons-round">arrow_back</i>
                    </button>
                    <div class="header-info">
                        <h1>${isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
                        <p class="subtitle">${isEdit ? 'Refine details' : 'Draft a new invoice'}</p>
                    </div>
                </div>
                <div class="header-actions">
                     <div class="status-indicator">
                        <span class="status-dot"></span> Draft
                     </div>
                </div>
            </div>
            
            <!-- Scrollable Content Area -->
            <div class="editor-scroll-area">
                <form id="invoiceForm" class="invoice-editor-form modern-form">
                    <div class="editor-grid">
                        <!-- Left Column: Main Form -->
                        <div class="editor-main">
                            <!-- Customer Selection Card -->
                            <div class="form-card modern-card customer-card">
                                <div class="card-header-modern">
                                    <div class="icon-box"><i class="material-icons-round">person</i></div>
                                    <h3>Customer Details</h3>
                                </div>
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="input-group-ims floating-label">
                                            <div class="customer-select-wrapper">
                                                <select id="invoiceCustomer" class="customer-select-ims modern-select" required>
                                                    <option value="">Loading customers...</option>
                                                </select>
                                                <label for="invoiceCustomer">Select Customer</label>
                                                <button type="button" class="btn-icon-ims quick-add" onclick="window.quickAddCustomerFromInvoice()" title="Add New Customer">
                                                    <i class="material-icons-round">add</i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Invoice Meta Data -->
                            <div class="form-card modern-card meta-card">
                                <div class="card-header-modern">
                                    <div class="icon-box"><i class="material-icons-round">event_note</i></div>
                                    <h3>Invoice Properties</h3>
                                </div>
                                <div class="card-body">
                                    <div class="form-row">
                                        <div class="input-group-ims floating-label">
                                            <input type="date" id="invoiceDate" value="${today}" class="modern-input">
                                            <label>Invoice Date</label>
                                        </div>
                                        <div class="input-group-ims floating-label">
                                            <input type="date" id="invoiceDueDate" value="" class="modern-input">
                                            <label>Due Date</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Items Table -->
                            <div class="form-card modern-card items-card">
                                <div class="card-header-modern">
                                    <div class="icon-box"><i class="material-icons-round">shopping_cart</i></div>
                                    <h3>Line Items</h3>
                                </div>
                                <div class="card-body no-padding">
                                    <div class="items-table-wrapper">
                                        <table class="items-table modern-table" id="invoiceItemsTable">
                                            <thead>
                                                <tr>
                                                    <th style="min-width: 200px;">Description</th>
                                                    <th style="min-width: 140px;">Category</th>
                                                    <th style="min-width: 100px;">Phase</th>
                                                    <th style="min-width: 120px;">Location</th>
                                                    <th style="min-width: 80px;">Qty</th>
                                                    <th style="min-width: 80px;">Unit</th>
                                                    <th style="min-width: 100px;">Rate</th>
                                                    <th style="min-width: 100px; text-align: right;">Total</th>
                                                    <th style="width: 50px;"></th>
                                                </tr>
                                            </thead>
                                            <tbody id="invoiceItemsBody">
                                                <tr class="item-row" data-index="0">
                                                    <td><input type="text" class="item-desc modern-input" placeholder="Item description"></td>
                                                    <td>
                                                        <select class="item-boq modern-select">
                                                            <option value="">Select category</option>
                                                            <option value="civil">Civil</option>
                                                            <option value="electrical">Electrical</option>
                                                            <option value="plumbing">Plumbing</option>
                                                            <option value="hvac">HVAC</option>
                                                            <option value="interior">Interior</option>
                                                            <option value="furniture">Furniture</option>
                                                            <option value="finishing">Finishing</option>
                                                            <option value="landscaping">Landscaping</option>
                                                            <option value="misc">Miscellaneous</option>
                                                        </select>
                                                    </td>
                                                    <td><input type="text" class="item-phase modern-input" placeholder="Phase 1"></td>
                                                    <td><input type="text" class="item-location modern-input" placeholder="Floor 2"></td>
                                                    <td><input type="number" class="item-qty modern-input" value="1" min="0" step="0.01"></td>
                                                    <td>
                                                        <select class="item-unit modern-select">
                                                            <option value="pcs">pcs</option>
                                                            <option value="sqft">sqft</option>
                                                            <option value="rft">rft</option>
                                                            <option value="cft">cft</option>
                                                            <option value="set">set</option>
                                                            <option value="lump">lump</option>
                                                            <option value="kg">kg</option>
                                                            <option value="m">m</option>
                                                        </select>
                                                    </td>
                                                    <td><input type="number" class="item-price modern-input" value="0" min="0" step="0.01"></td>
                                                    <td class="item-total">৳0</td>
                                                    <td><button type="button" class="btn-icon-ims danger remove-item-btn"><i class="material-icons-round">remove_circle_outline</i></button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="add-item-row">
                                        <button type="button" class="btn-secondary-ims" id="addItemBtn">
                                            <i class="material-icons-round">add</i> Add Item
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Bottom Row: Notes & Totals Split -->
                            <div class="bottom-split-row">
                                <!-- Notes (Left) -->
                                <div class="form-card modern-card notes-card">
                                    <div class="card-header-modern">
                                        <div class="icon-box"><i class="material-icons-round">sticky_note_2</i></div>
                                        <h3>Additional Notes</h3>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <div class="input-group-ims">
                                                <label>Terms & Conditions</label>
                                                <textarea id="invoiceTerms" rows="2" class="modern-input" placeholder="Specific terms for this invoice..."></textarea>
                                            </div>
                                        </div>
                                        <div class="form-row">
                                            <div class="input-group-ims">
                                                <label>Internal Notes</label>
                                                <textarea id="invoiceNotes" rows="2" class="modern-input" placeholder="Private notes..."></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Totals (Right) -->
                                <div class="form-card modern-card totals-card">
                                    <div class="card-header-modern">
                                        <div class="icon-box"><i class="material-icons-round">receipt</i></div>
                                        <h3>Summary</h3>
                                    </div>
                                    <div class="card-body">
                                        <div class="totals-grid modern-totals">
                                            <div class="total-row">
                                                <span>Subtotal</span>
                                                <span id="invoiceSubtotal">৳0</span>
                                            </div>
                                            <div class="total-row input-row">
                                                <span>Discount</span>
                                                <div class="combined-input">
                                                    <input type="number" id="invoiceDiscount" value="0" min="0" step="0.01" class="modern-input right-align">
                                                    <select id="discountType" class="modern-select small">
                                                        <option value="fixed">৳</option>
                                                        <option value="percent">%</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="total-row input-row">
                                                <span>Tax/VAT (%)</span>
                                                <input type="number" id="invoiceTaxRate" value="0" min="0" max="100" step="0.1" class="modern-input right-align tax-input">
                                            </div>
                                            <div class="total-divider"></div>
                                            <div class="total-row grand-total">
                                                <span>Total Due</span>
                                                <span id="invoiceTotal" class="highlight-text">৳0</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Fixed Footer Actions -->
            <div class="invoice-editor-footer-ims fixed-footer">
                <div class="footer-left">
                     <button type="button" class="btn-secondary-ims btn-preview" onclick="window.previewCurrentInvoice()">
                        <i class="material-icons-round">visibility</i> Preview
                    </button>
                    <button type="button" class="btn-secondary-ims btn-pdf" onclick="window.downloadCurrentInvoice('pdf')">
                        <i class="material-icons-round">picture_as_pdf</i> PDF
                    </button>
                    <button type="button" class="btn-secondary-ims btn-image" onclick="window.downloadCurrentInvoice('image')">
                        <i class="material-icons-round">image</i> Image
                    </button>
                </div>
                <div class="footer-right">
                    <button type="button" class="btn-secondary-ims" onclick="window.cancelInvoiceEditor()">
                        Cancel
                    </button>
                    <button type="button" id="saveInvoiceBtn" class="btn-primary-ims large">
                        <i class="material-icons-round">save</i> ${isEdit ? 'Save Changes' : 'Create Invoice'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners immediately
    setupInvoiceFormEvents(invoiceId);

    // Load data asynchronously in background
    loadInvoiceEditorData(invoiceId, isEdit);
}

// Make functions global
window.showInvoiceEditor = showInvoiceEditor;
window.showExportLogPage = showExportLogPage;
window.viewSnapshot = viewSnapshot;

/**
 * Show Export Log Page
 */
export async function showExportLogPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    content.innerHTML = `
        <div class="ims-page">
            <div class="page-header-ims">
                <div class="header-left" style="display: flex; align-items: center; gap: 15px;">
                    <button class="btn-icon-ims" onclick="window.renderInvoicesPage()" style="background: white; border: 1px solid #e2e8f0; width: 40px; height: 40px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: all 0.2s;">
                        <i class="material-icons-round" style="font-size: 20px; color: #1e293b;">arrow_back</i>
                    </button>
                    <div class="header-info">
                        <h2><i class="material-icons-round">history</i> Exported Invoices Log</h2>
                        <p class="subtitle">History of all exported PDFs and Images</p>
                    </div>
                </div>
            </div>
            
            <div class="invoices-table-wrapper">
                <table class="invoices-table" id="exportLogTable">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>Invoice #</th>
                            <th>Type</th>
                            <th>Exported By</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="exportLogBody">
                        <tr><td colspan="5" class="loading-row"><div class="spinner"></div> Loading logs...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const logs = await getExportedInvoices();

        if (logs.length === 0) {
            document.getElementById('exportLogBody').innerHTML = `
                <tr>
                    <td colspan="5" class="empty-row">
                        <div class="empty-state-ims">
                            <i class="material-icons-round">history_toggle_off</i>
                            <h3>No Exports Found</h3>
                            <p>Export an invoice to see it here</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        document.getElementById('exportLogBody').innerHTML = logs.map(log => {
            const date = log.exportedAt?.toDate ? log.exportedAt.toDate() : new Date(log.exportedAt);
            const dateStr = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            return `
            <tr>
                <td class="date">${dateStr}</td>
                <td class="invoice-number">${log.snapshot?.invoice?.invoiceNumber || '-'}</td>
                <td style="text-transform: uppercase; font-weight: 600; font-size: 12px;">
                    <span class="status-badge-ims ${log.exportType === 'pdf' ? 'issued' : 'draft'}">${log.exportType}</span>
                </td>
                <td>
                    <span style="font-weight: 500;">${log.exportedByName || 'System'}</span>
                </td>
                <td>
                    <button class="btn-icon-ims" onclick="window.viewSnapshot('${log.id}')" title="View Exact Copy">
                        <i class="material-icons-round">visibility</i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        // Store logs globally for easy retrieval by ID
        window._exportedLogs = logs;

    } catch (error) {
        console.error("Error loading export logs:", error);
        document.getElementById('exportLogBody').innerHTML = '<tr><td colspan="5" class="error-row">Failed to load logs.</td></tr>';
    }
}

/**
 * View Export Snapshot
 */
export function viewSnapshot(logId) {
    const logs = window._exportedLogs || [];
    const log = logs.find(l => l.id === logId);

    if (!log || !log.snapshot) {
        showToast("Log entry details not found", "error");
        return;
    }

    const { invoice, customer, company, timestamp } = log.snapshot;

    // We construct a combined object because previewInvoiceFromData expects (data, options)
    // where data basically serves as the invoice + customerSnapshot.
    // However, our previewInvoiceFromData separates them cleanly if we pass them right.

    // Actually, `previewInvoiceFromData(data)` uses `data` as the invoice object.
    // It looks for `data.customerSnapshot` OR `data` itself for customer details.

    // So we should attach customer to invoice if not present, OR just rely on our updated previewInvoiceFromData logic.
    // My update to previewInvoiceFromData: `const customer = data.customerSnapshot || data;`
    // So if I pass `invoice` as `data`, and `invoice.customerSnapshot` is missing (it might be), I should ensure it's there.

    const displayInvoice = { ...invoice, customerSnapshot: customer || invoice.customerSnapshot };

    previewInvoiceFromData(displayInvoice, {
        companyOverride: company,
        title: `Snapshot: ${log.exportType.toUpperCase()} of ${invoice.invoiceNumber}`,
        logExport: false, // Do not log again when downloading from snapshot
        creationDate: timestamp ? new Date(timestamp) : null // Pass the frozen timestamp
    });
}


/**
 * Quick Add Customer from Invoice Editor
 */
window.quickAddCustomerFromInvoice = async function () {
    // Dynamic import to avoid circular dependency issues at top level
    const { showCustomerModal } = await import('./customer-ui.js');

    showCustomerModal(null, async (newCustomerId) => {
        if (newCustomerId) {
            // Reload dropdown
            const { getCurrentCustomers } = await import('./customers.js');
            const customers = await getCurrentCustomers();
            const customerSelect = document.getElementById('invoiceCustomer');

            if (customerSelect) {
                customerSelect.innerHTML = customers.length > 0
                    ? `<option value="">Select a customer...</option>` +
                    customers.map(c => `<option value="${c.id}" ${c.id === newCustomerId ? 'selected' : ''}>${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('')
                    : `<option value="">No customers found</option>`;

                // Trigger change event if needed
                customerSelect.value = newCustomerId;
            }
            showToast("Customer added and selected!", "success");
        }
    });
};

/**
 * Setup form event listeners (runs immediately)
 */
function setupInvoiceFormEvents(invoiceId) {
    // Add item button
    document.getElementById('addItemBtn')?.addEventListener('click', addItemRow);

    // Remove item buttons
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => removeItemRow(e));
    });

    // Recalculate on input changes
    document.getElementById('invoiceItemsBody')?.addEventListener('input', recalculateTotals);
    document.getElementById('invoiceDiscount')?.addEventListener('input', recalculateTotals);
    document.getElementById('discountType')?.addEventListener('change', recalculateTotals);
    document.getElementById('invoiceTaxRate')?.addEventListener('input', recalculateTotals);

    // Prevent Enter key from submitting (except in textareas)
    document.getElementById('invoiceForm')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            return false;
        }
    });

    // Form submit / Save button
    document.getElementById('saveInvoiceBtn')?.addEventListener('click', () => {
        saveInvoice(invoiceId);
    });

    // We still prevent form default submit just in case
    document.getElementById('invoiceForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
    });
}

/**
 * Load customers and invoice data asynchronously
 */
async function loadInvoiceEditorData(invoiceId, isEdit) {
    const customerSelect = document.getElementById('invoiceCustomer');

    try {
        // Load customers
        const customers = await getCurrentCustomers();

        if (customerSelect) {
            customerSelect.innerHTML = customers.length > 0
                ? `<option value="">Select a customer...</option>` +
                customers.map(c => `<option value="${c.id}">${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('')
                : `<option value="">No customers found - add one first</option>`;

            // Auto-select first customer if creating new invoice and only one customer
            if (!isEdit && customers.length === 1) {
                customerSelect.value = customers[0].id;
            }
        }

        // If editing, load invoice data
        if (isEdit && invoiceId) {
            const invoice = await getInvoice(invoiceId);
            if (invoice) {
                populateInvoiceForm(invoice);
            } else {
                showToast("Invoice not found", "error");
                renderInvoicesPage();
            }
        }
    } catch (error) {
        console.error("Error loading invoice data:", error);
        if (customerSelect) {
            customerSelect.innerHTML = `<option value="">Error loading customers</option>`;
        }
    }
}

/**
 * Populate form with existing invoice data
 */
function populateInvoiceForm(invoice) {
    // Customer
    const customerSelect = document.getElementById('invoiceCustomer');
    if (customerSelect && invoice.customerId) {
        customerSelect.value = invoice.customerId;
    }

    // Dates
    document.getElementById('invoiceDate').value = invoice.date || '';
    document.getElementById('invoiceDueDate').value = invoice.dueDate || '';

    // Update subtitle
    const subtitle = document.querySelector('.invoice-editor-page .subtitle');
    if (subtitle) {
        subtitle.textContent = `Editing ${invoice.invoiceNumber || 'Draft'}`;
    }

    // Items
    const tbody = document.getElementById('invoiceItemsBody');
    if (tbody && invoice.items?.length > 0) {
        tbody.innerHTML = invoice.items.map((item, idx) => `
            <tr class="item-row" data-index="${idx}">
                <td><input type="text" class="item-desc" value="${item.description || ''}" placeholder="Item description"></td>
                <td>
                    <select class="item-boq">
                        <option value="" ${!item.boqCategory ? 'selected' : ''}>-</option>
                        <option value="civil" ${item.boqCategory === 'civil' ? 'selected' : ''}>Civil</option>
                        <option value="electrical" ${item.boqCategory === 'electrical' ? 'selected' : ''}>Electrical</option>
                        <option value="plumbing" ${item.boqCategory === 'plumbing' ? 'selected' : ''}>Plumbing</option>
                        <option value="hvac" ${item.boqCategory === 'hvac' ? 'selected' : ''}>HVAC</option>
                        <option value="interior" ${item.boqCategory === 'interior' ? 'selected' : ''}>Interior</option>
                        <option value="furniture" ${item.boqCategory === 'furniture' ? 'selected' : ''}>Furniture</option>
                        <option value="finishing" ${item.boqCategory === 'finishing' ? 'selected' : ''}>Finishing</option>
                        <option value="landscaping" ${item.boqCategory === 'landscaping' ? 'selected' : ''}>Landscaping</option>
                        <option value="misc" ${item.boqCategory === 'misc' ? 'selected' : ''}>Miscellaneous</option>
                    </select>
                </td>
                <td><input type="text" class="item-phase" value="${item.phase || ''}" placeholder="e.g. Phase 1"></td>
                <td><input type="text" class="item-location" value="${item.location || ''}" placeholder="e.g. Floor 2"></td>
                <td><input type="number" class="item-qty" value="${item.qty || 1}" min="1" step="0.01"></td>
                <td>
                    <select class="item-unit">
                        <option value="pcs" ${item.unit === 'pcs' ? 'selected' : ''}>pcs</option>
                        <option value="sqft" ${item.unit === 'sqft' ? 'selected' : ''}>sqft</option>
                        <option value="rft" ${item.unit === 'rft' ? 'selected' : ''}>rft</option>
                        <option value="cft" ${item.unit === 'cft' ? 'selected' : ''}>cft</option>
                        <option value="set" ${item.unit === 'set' ? 'selected' : ''}>set</option>
                        <option value="lump" ${item.unit === 'lump' ? 'selected' : ''}>lump</option>
                        <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
                        <option value="m" ${item.unit === 'm' ? 'selected' : ''}>m</option>
                    </select>
                </td>
                <td><input type="number" class="item-price" value="${item.unitPrice || 0}" min="0" step="0.01"></td>
                <td class="item-total">${formatCurrency(item.total || 0)}</td>
                <td><button type="button" class="btn-icon-ims danger remove-item-btn"><i class="material-icons-round">close</i></button></td>
            </tr>
        `).join('');

        // Re-attach remove button handlers
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => removeItemRow(e));
        });
    }

    // Totals
    document.getElementById('invoiceDiscount').value = invoice.discount || 0;
    document.getElementById('discountType').value = invoice.discountType || 'fixed';
    document.getElementById('invoiceTaxRate').value = invoice.taxRate || 0;

    // Notes
    document.getElementById('invoiceTerms').value = invoice.terms || '';
    document.getElementById('invoiceNotes').value = invoice.notes || '';

    // Recalculate
    recalculateTotals();
}

// Cancel and go back to invoices list
window.cancelInvoiceEditor = function () {
    if (confirm('Are you sure you want to cancel? Unsaved changes will be lost.')) {
        renderInvoicesPage();
    }
};

/**
 * Add a new item row to the invoice
 */
function addItemRow() {
    const tbody = document.getElementById('invoiceItemsBody');
    const rowCount = tbody.querySelectorAll('.item-row').length;

    const newRow = document.createElement('tr');
    newRow.className = 'item-row';
    newRow.dataset.index = rowCount;
    newRow.innerHTML = `
        <td><input type="text" class="item-desc modern-input" value="" placeholder="Item description"></td>
        <td>
            <select class="item-boq modern-select">
                <option value="">Select category</option>
                <option value="civil">Civil</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="interior">Interior</option>
                <option value="furniture">Furniture</option>
                <option value="finishing">Finishing</option>
                <option value="landscaping">Landscaping</option>
                <option value="misc">Miscellaneous</option>
            </select>
        </td>
        <td><input type="text" class="item-phase modern-input" value="" placeholder="Phase 1"></td>
        <td><input type="text" class="item-location modern-input" value="" placeholder="Floor 2"></td>
        <td><input type="number" class="item-qty modern-input" value="1" min="1" step="0.01"></td>
        <td>
            <select class="item-unit modern-select">
                <option value="pcs">pcs</option>
                <option value="sqft">sqft</option>
                <option value="rft">rft</option>
                <option value="cft">cft</option>
                <option value="set">set</option>
                <option value="lump">lump</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
            </select>
        </td>
        <td><input type="number" class="item-price modern-input" value="0" min="0" step="0.01"></td>
        <td class="item-total">${formatCurrency(0)}</td>
        <td><button type="button" class="btn-icon-ims danger remove-item-btn"><i class="material-icons-round">remove_circle_outline</i></button></td>
    `;

    tbody.appendChild(newRow);
    newRow.querySelector('.remove-item-btn').addEventListener('click', (e) => removeItemRow(e));
}

/**
 * Remove an item row
 */
function removeItemRow(e) {
    const tbody = document.getElementById('invoiceItemsBody');
    if (tbody.querySelectorAll('.item-row').length > 1) {
        e.target.closest('.item-row').remove();
        recalculateTotals();
    } else {
        showToast("Invoice must have at least one item", "error");
    }
}

/**
 * Recalculate invoice totals
 */
function recalculateTotals() {
    const rows = document.querySelectorAll('#invoiceItemsBody .item-row');
    let subtotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const total = qty * price;
        row.querySelector('.item-total').textContent = formatCurrency(total);
        subtotal += total;
    });

    const discount = parseFloat(document.getElementById('invoiceDiscount')?.value) || 0;
    const discountType = document.getElementById('discountType')?.value || 'fixed';
    const taxRate = parseFloat(document.getElementById('invoiceTaxRate')?.value) || 0;

    let discountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate / 100;
    const total = taxableAmount + taxAmount;

    document.getElementById('invoiceSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('invoiceTotal').textContent = formatCurrency(total);
}

/**
 * Save invoice (create or update)
 */
async function saveInvoice(invoiceId = null) {
    const customerId = document.getElementById('invoiceCustomer')?.value;
    if (!customerId) {
        showToast("Please select a customer", "error");
        return;
    }

    const customer = await getCustomer(customerId);
    const items = [];

    document.querySelectorAll('#invoiceItemsBody .item-row').forEach(row => {
        const desc = row.querySelector('.item-desc')?.value.trim();
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const unit = row.querySelector('.item-unit')?.value || 'pcs';
        const unitPrice = parseFloat(row.querySelector('.item-price')?.value) || 0;
        // Construction-specific fields
        const boqCategory = row.querySelector('.item-boq')?.value || '';
        const phase = row.querySelector('.item-phase')?.value.trim() || '';
        const location = row.querySelector('.item-location')?.value.trim() || '';

        if (desc && qty > 0) {
            items.push({
                description: desc,
                qty,
                unit,
                unitPrice,
                total: qty * unitPrice,
                // Construction fields
                boqCategory,
                phase,
                location
            });
        }
    });

    if (items.length === 0) {
        showToast("Please add at least one item", "error");
        return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = parseFloat(document.getElementById('invoiceDiscount')?.value) || 0;
    const discountType = document.getElementById('discountType')?.value || 'fixed';
    const taxRate = parseFloat(document.getElementById('invoiceTaxRate')?.value) || 0;

    let discountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * taxRate / 100;
    const total = taxableAmount + tax;

    const invoiceData = {
        customerId,
        customerSnapshot: customer ? { name: customer.name, company: customer.company, email: customer.email } : null,
        date: document.getElementById('invoiceDate')?.value,
        dueDate: document.getElementById('invoiceDueDate')?.value || null,
        items,
        subtotal,
        discount,
        discountType,
        taxRate,
        tax,
        total,
        terms: document.getElementById('invoiceTerms')?.value.trim(),
        notes: document.getElementById('invoiceNotes')?.value.trim()
    };

    const saveBtn = document.getElementById('saveInvoiceBtn');
    if (saveBtn) {
        if (saveBtn.disabled) return; // Prevent multiple clicks
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="material-icons-round rotating">sync</i> Saving...';
    }

    try {
        let success;
        if (invoiceId) {
            success = await updateInvoice(invoiceId, invoiceData);
            if (success) showToast("Invoice updated successfully", "success");
        } else {
            const newId = await createInvoice(invoiceData);
            success = !!newId;
            if (success) showToast("Invoice created successfully", "success");
        }

        if (success) {
            // Navigate back to invoices list
            renderInvoicesPage();
        } else {
            // Re-enable button if failed
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="material-icons-round">save</i> ${invoiceId ? 'Update Invoice' : 'Create Invoice'}`;
            }
        }
    } catch (err) {
        console.error("Save error:", err);
        showToast("Error saving invoice", "error");
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="material-icons-round">save</i> ${invoiceId ? 'Update Invoice' : 'Create Invoice'}`;
        }
    }
}

/**
 * Get current form data as an invoice object for preview/download
 */
async function getCurrentEditorData() {
    const customerId = document.getElementById('invoiceCustomer')?.value;
    const items = [];

    document.querySelectorAll('#invoiceItemsBody .item-row').forEach(row => {
        const desc = row.querySelector('.item-desc')?.value.trim();
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const unit = row.querySelector('.item-unit')?.value || 'pcs';
        const unitPrice = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const boqCategory = row.querySelector('.item-boq')?.value || '';
        const phase = row.querySelector('.item-phase')?.value.trim() || '';
        const location = row.querySelector('.item-location')?.value.trim() || '';

        if (desc) {
            items.push({
                description: desc,
                qty,
                unit,
                unitPrice,
                total: qty * unitPrice,
                boqCategory,
                phase,
                location
            });
        }
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = parseFloat(document.getElementById('invoiceDiscount')?.value) || 0;
    const discountType = document.getElementById('discountType')?.value || 'fixed';
    const taxRate = parseFloat(document.getElementById('invoiceTaxRate')?.value) || 0;

    let discountAmount = discountType === 'percent' ? (subtotal * discount / 100) : discount;
    const taxableAmount = subtotal - discountAmount;
    const tax = taxableAmount * taxRate / 100;
    const total = taxableAmount + tax;

    let customerSnapshot = null;
    if (customerId) {
        const customer = await getCustomer(customerId);
        if (customer) {
            customerSnapshot = { name: customer.name, company: customer.company, email: customer.email };
        }
    }

    return {
        invoiceNumber: document.querySelector('.page-header-ims h2')?.textContent.includes('Edit') ? 'PREVIEW' : 'DRAFT',
        customerId,
        customerSnapshot,
        date: document.getElementById('invoiceDate')?.value,
        dueDate: document.getElementById('invoiceDueDate')?.value || null,
        items,
        subtotal,
        discount,
        discountType,
        taxRate,
        tax,
        total,
        totalPaid: 0,
        dueAmount: total,
        status: 'draft',
        terms: document.getElementById('invoiceTerms')?.value.trim(),
        notes: document.getElementById('invoiceNotes')?.value.trim()
    };
}

// Global helpers for editor
window.previewCurrentInvoice = async function () {
    const data = await getCurrentEditorData();
    const { previewInvoice } = await import('./invoice-pdf.js');

    // Create a temporary mock of previewInvoice that takes data instead of ID
    // or better, update invoice-pdf.js to handle both.
    // For now, let's just use the data directly if we can.
    const company = await (await import('./company-settings.js')).getCompanySettings();
    const html = await (await import('./invoice-pdf.js')).downloadInvoicePDF(data, null); // Mock call or use a new method
};

// Actually, let's update invoice-pdf.js to handle data objects directly in preview.
// For now, I'll add these window helpers:

window.downloadCurrentInvoice = async function (type) {
    const data = await getCurrentEditorData();
    const { downloadInvoicePDF, downloadInvoiceImage } = await import('./invoice-pdf.js');
    if (type === 'pdf') {
        downloadInvoicePDF(data);
    } else {
        downloadInvoiceImage(data);
    }
};

window.previewCurrentInvoice = async function () {
    const data = await getCurrentEditorData();
    const { previewInvoiceDirect } = await (async () => {
        // I'll add this to invoice-pdf.js
        const mod = await import('./invoice-pdf.js');
        return mod;
    })();

    // I need to update invoice-pdf.js to export a direct previewer
    const company = await (await import('./company-settings.js')).getCompanySettings();

    // Re-using the logic from previewInvoice but with data
    const { previewInvoice } = await import('./invoice-pdf.js');
    // We can't call previewInvoice(data) because it expects an ID.
    // I will add a new function to invoice-pdf.js.

    // For now, let's just use window.downloadInvoicePDF(data) as a quick way to see it
    // But user wants a PREVIEW modal.

    // I will add 'previewInvoiceFromData' to invoice-pdf.js
    if (typeof window.previewInvoiceFromData === 'function') {
        window.previewInvoiceFromData(data);
    } else {
        // Fallback or wait
        showToast("Previewer loading...", "neutral");
    }
};

// Helper functions
function formatCurrency(amount) {
    return '৳' + (amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatStatus(status) {
    const statusMap = {
        'draft': 'Draft',
        'issued': 'Issued',
        'partially_paid': 'Partial',
        'paid': 'Paid',
        'overdue': 'Overdue',
        'cancelled': 'Cancelled',
        'locked': 'Locked'
    };
    return statusMap[status] || status;
}

// Global action handlers
window.viewInvoice = async function (invoiceId) {
    // Use PDF preview modal
    const { previewInvoice } = await import('./invoice-pdf.js');
    previewInvoice(invoiceId);
};

window.editInvoice = async function (invoiceId) {
    showInvoiceEditor(invoiceId);
};

window.issueInvoiceAction = async function (invoiceId) {
    if (confirm("Issue this invoice? It will be sent/marked as issued.")) {
        const success = await issueInvoice(invoiceId);
        if (success) {
            await loadInvoiceStats();
            await loadInvoicesTable(document.getElementById('invoiceStatusFilter')?.value || 'all');
        }
    }
};

// Enhanced payment modal with method selection
window.showPaymentModal = async function (invoiceId) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        showToast("Invoice not found", "error");
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal ims-modal payment-modal';
    modal.innerHTML = `
        <div class="modal-content ims-modal-content" style="max-width: 450px;">
            <div class="modal-header ims-modal-header">
                <h2><i class="material-icons-round">payments</i> Record Payment</h2>
                <button class="modal-close">&times;</button>
            </div>
            <form id="paymentForm" class="ims-form">
                <div class="payment-summary" style="background: #f1f5f9; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #64748b;">Invoice</span>
                        <strong>${invoice.invoiceNumber}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #64748b;">Total</span>
                        <span>${formatCurrency(invoice.total)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #64748b;">Already Paid</span>
                        <span style="color: #10b981;">${formatCurrency(invoice.totalPaid)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid #e2e8f0; font-weight: 600;">
                        <span style="color: #ef4444;">Balance Due</span>
                        <span style="color: #ef4444;">${formatCurrency(invoice.dueAmount)}</span>
                    </div>
                </div>
                
                <div class="input-group-ims">
                    <label>Payment Amount <span class="required">*</span></label>
                    <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b;">৳</span>
                        <input type="number" id="paymentAmount" value="${invoice.dueAmount}" min="1" max="${invoice.dueAmount}" step="0.01" required style="padding-left: 30px;">
                    </div>
                </div>
                
                <div class="input-group-ims">
                    <label>Payment Method</label>
                    <select id="paymentMethod">
                        <option value="cash">💵 Cash</option>
                        <option value="bank_transfer">🏦 Bank Transfer</option>
                        <option value="bkash">📱 bKash</option>
                        <option value="nagad">📱 Nagad</option>
                        <option value="card">💳 Card</option>
                        <option value="check">📝 Check</option>
                        <option value="other">📋 Other</option>
                    </select>
                </div>
                
                <div class="input-group-ims">
                    <label>Payment Date</label>
                    <input type="date" id="paymentDate" value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="input-group-ims">
                    <label>Note (optional)</label>
                    <input type="text" id="paymentNote" placeholder="e.g. Transaction ID, reference...">
                </div>
                
                <div class="modal-actions ims-modal-actions">
                    <button type="button" class="btn-secondary modal-close">Cancel</button>
                    <button type="submit" class="btn-primary-ims">
                        <i class="material-icons-round">check</i> Record Payment
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
    document.getElementById('paymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payment = {
            amount: parseFloat(document.getElementById('paymentAmount').value),
            method: document.getElementById('paymentMethod').value,
            date: document.getElementById('paymentDate').value,
            note: document.getElementById('paymentNote').value.trim()
        };

        if (payment.amount <= 0) {
            showToast("Please enter a valid amount", "error");
            return;
        }

        const success = await addPayment(invoiceId, payment);
        if (success) {
            modal.remove();
            await loadInvoiceStats();
            await loadInvoicesTable(document.getElementById('invoiceStatusFilter')?.value || 'all');
        }
    });
};

// Clone invoice feature
window.cloneInvoice = async function (invoiceId) {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        showToast("Invoice not found", "error");
        return;
    }

    if (confirm(`Clone invoice ${invoice.invoiceNumber}? This will create a new draft with the same items.`)) {
        const cloneData = {
            customerId: invoice.customerId,
            customerSnapshot: invoice.customerSnapshot,
            date: new Date().toISOString().split('T')[0],
            dueDate: null,
            items: invoice.items,
            subtotal: invoice.subtotal,
            discount: invoice.discount,
            discountType: invoice.discountType,
            taxRate: invoice.taxRate,
            tax: invoice.tax,
            total: invoice.total,
            terms: invoice.terms,
            notes: `Cloned from ${invoice.invoiceNumber}`
        };

        const newId = await createInvoice(cloneData);
        if (newId) {
            showToast("Invoice cloned successfully!", "success");
            await loadInvoiceStats();
            await loadInvoicesTable('draft');
            document.getElementById('invoiceStatusFilter').value = 'draft';
        }
    }
};

window.deleteInvoiceAction = async function (invoiceId) {
    if (confirm("Are you sure you want to delete this invoice? This cannot be undone.")) {
        const success = await deleteInvoice(invoiceId);
        if (success) {
            await loadInvoiceStats();
            await loadInvoicesTable(document.getElementById('invoiceStatusFilter')?.value || 'all');
        }
    }
};

// Lock/unlock invoice (Admin only)
window.lockInvoiceAction = async function (invoiceId, lock) {
    const { setInvoiceLock } = await import('./invoices.js');
    const action = lock ? "lock" : "unlock";

    if (confirm(`Are you sure you want to ${action} this invoice?`)) {
        const success = await setInvoiceLock(invoiceId, lock);
        if (success) {
            showToast(`Invoice ${lock ? 'locked' : 'unlocked'}`, "success");
            await loadInvoiceStats();
            await loadInvoicesTable(document.getElementById('invoiceStatusFilter')?.value || 'all');
        }
    }
};

// Cancel invoice (Admin only)
window.cancelInvoiceAction = async function (invoiceId) {
    const { cancelInvoice } = await import('./invoices.js');

    if (confirm("Are you sure you want to cancel this invoice? This action can be undone by unlocking.")) {
        const success = await cancelInvoice(invoiceId);
        if (success) {
            showToast("Invoice cancelled", "success");
            await loadInvoiceStats();
            await loadInvoicesTable(document.getElementById('invoiceStatusFilter')?.value || 'all');
        }
    }
};

// Import invoice history for admin
import('./invoice-history.js').catch(err => console.log('Invoice history module not loaded'));

window.quickAddCustomerFromInvoice = function () {
    import('./customer-ui.js').then(() => {
        if (typeof window.editCustomer === 'function') {
            // Will trigger the customer modal from customer-ui.js
        }
    });
};

