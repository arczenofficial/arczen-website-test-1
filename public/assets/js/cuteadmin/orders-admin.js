import {
    collection, doc, updateDoc, getDocs, addDoc,
    query, orderBy, where, serverTimestamp, getDoc, arrayUnion, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast, utils } from './utils.js';
import { getYearMonthDayPath, getYearMonthPath } from './db.js';
import { finance } from './finance-engine.js';

const STATUS_CONFIG = {
    pending:     { label: 'SIGNAL', icon: 'ph-broadcast', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' },
    received:    { label: 'VERIFIED', icon: 'ph-currency-circle-dollar', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
    confirmed:   { label: 'ROUTED', icon: 'ph-corners-out', color: 'var(--accent)', bg: 'rgba(0, 201, 188, 0.1)' },
    in_progress: { label: 'PROCESSING', icon: 'ph-gear-six', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    delivered:   { label: 'SETTLED', icon: 'ph-check-circle', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)' },
    partial:     { label: 'PARTIAL', icon: 'ph-selection-plus', color: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
    cancelled:   { label: 'VOIDED', icon: 'ph-prohibit', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)' }
};

export async function renderOrdersPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    content.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Transaction Terminal</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Priority Fulfillment Queue (Live)</p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="exportOrdersBtn" class="action-btn-v2" title="Export CSV"><i class="ph ph-export"></i></button>
                    <button id="refreshOrdersBtn" class="action-btn-v2" title="Refresh Feed"><i class="ph ph-arrows-clockwise"></i></button>
                </div>
            </div>

            <!-- Operational Strips -->
            <div class="metrics-strip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="mini-card">
                    <span class="label">PENDING SIGNALS</span>
                    <div class="val" id="pendingOrderCount">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">DAILY GROSS</span>
                    <div class="val accent" id="dailyGrossRev">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">EST. MARGIN</span>
                    <div class="val" id="dailyAvgMargin">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">FULFILLMENT RATE</span>
                    <div class="val" id="fulfillmentRate">--</div>
                </div>
            </div>

            <!-- Filters -->
            <div class="terminal-controls" style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center;">
                <div class="filter-pills" style="flex:1;">
                    <button class="pill active" data-status="active">ACTIVE SIGNALS</button>
                    <button class="pill" data-status="pending">PENDING</button>
                    <button class="pill" data-status="received">RECEIVED</button>
                    <button class="pill" data-status="confirmed">ROUTED</button>
                    <button class="pill" data-status="delivered">SETTLED</button>
                    <button class="pill" data-status="all">ALL HISTORY</button>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span class="dim-label" style="font-size:0.65rem; font-weight:700;">CHRONO_WINDOW:</span>
                    <select id="timeFilterSelect" class="terminal-select">
                        <option value="all">ALL_TIME</option>
                        <option value="24h">LAST_24H</option>
                        <option value="7d">LAST_7D</option>
                        <option value="30d">LAST_30D</option>
                    </select>
                </div>
                <div id="ordersBulkActions" style="display:none; gap:8px;">
                     <button id="bulkSettleBtn" class="premium-btn primary" style="padding:4px 12px; font-size:0.7rem;">SETTLE_SELECTED</button>
                </div>
            </div>

            <div id="ordersTerminalTable" style="background: var(--bg-surface); border-radius: 12px; height: 600px; overflow: hidden; border: 1px solid var(--border);"></div>
            
            <div id="orderTableLoader" class="terminal-loader" style="display:none;">
                <div class="scanner"></div>
                <span>Syncing signals...</span>
            </div>
        </div>

        <!-- Terminal Detail Modal -->
        <div id="orderModal" class="terminal-modal">
            <div class="modal-surface premium animate-slide-up">
                <div class="modal-header-v3">
                    <div>
                        <h3 id="orderModalTitle" style="margin:0; font-size:1.2rem; font-weight:900; letter-spacing:-0.5px;">IDENT_LOG_ANALYSIS</h3>
                        <p id="orderModalSubtitle" style="margin:5px 0 0; font-size:0.7rem; color:var(--text-dim); font-family:'JetBrains Mono';">NODE_ID: #8A23B1</p>
                    </div>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <button id="printReceiptBtn" class="action-btn-v2" title="Generate Receipt"><i class="ph ph-printer"></i></button>
                        <button id="closeOrderModal" class="icon-btn" style="background:rgba(255,255,255,0.05); border-radius:50%; width:36px; height:36px;"><i class="ph ph-x"></i></button>
                    </div>
                </div>
                <div id="orderModalBody" class="modal-dashboard">
                    <!-- Dynamic Dashboard Content -->
                </div>
            </div>
        </div>
    `;

    setupOrdersUI();
    await loadOrdersTerminal('all');
}

let ordersTable = null;

async function loadOrdersTerminal(statusFilter = 'active', timeFilterRange = 'all') {
    const loader = document.getElementById('orderTableLoader');
    if (loader) loader.style.display = 'flex';

    try {
        let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

        if (timeFilterRange !== 'all') {
            const now = new Date();
            let threshold = new Date();
            if (timeFilterRange === '24h') threshold.setHours(now.getHours() - 24);
            if (timeFilterRange === '7d') threshold.setDate(now.getDate() - 7);
            if (timeFilterRange === '30d') threshold.setDate(now.getDate() - 30);
            
            q = query(collection(db, 'orders'), where('createdAt', '>=', threshold), orderBy('createdAt', 'desc'));
        }
        
        const snap = await getDocs(q);
        const orders = snap.docs.map(d => ({ 
            id: d.id, 
            fullPath: d.ref.path, 
            ...d.data() 
        }));

        // Custom sorting logic for priority fulfillment
        const sortPriority = { 
            pending: 1, 
            received: 2,
            confirmed: 3, 
            in_progress: 4, 
            shipped: 5, 
            delivered: 6, 
            cancelled: 7 
        };

        orders.sort((a, b) => {
            const pA = sortPriority[a.status] || 99;
            const pB = sortPriority[b.status] || 99;
            if (pA !== pB) return pA - pB;
            // secondary sort by time (newest unfulfilled first)
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });

        // Stats Logic
        let dayRev = 0;
        let dayProfit = 0;
        orders.forEach(o => {
            dayRev += (o.amount || o.totalAmount || 0);
            const cost = o.items?.reduce((s, i) => s + (i.cost || 0), 0) || 0;
            dayProfit += ((o.amount || 0) - cost);
        });

        document.getElementById('pendingOrderCount').textContent = orders.filter(o => o.status === 'pending').length;
        document.getElementById('dailyGrossRev').textContent = `৳${dayRev.toLocaleString()}`;
        document.getElementById('dailyAvgMargin').textContent = dayRev > 0 ? ((dayProfit / dayRev) * 100).toFixed(0) + '%' : '0%';
        document.getElementById('fulfillmentRate').textContent = orders.length > 0 ? ((orders.filter(o => o.status === 'delivered').length / orders.length) * 100).toFixed(0) + '%' : '0%';

        if (ordersTable) ordersTable.destroy();

        ordersTable = new Tabulator("#ordersTerminalTable", {
            data: orders,
            layout: "fitColumns",
            height: "100%",
            selectable: false, // User requested removing "hassle" of selection
            rowClick: function(e, row) {
                const data = row.getData();
                openOrderModal({ ...data, id: data.id, fullPath: data.fullPath });
            },
            columns: [
                {title: "PRIMARY ASSET", field: "items", widthGrow: 2, headerFilter: "input", formatter: (cell) => {
                    const items = cell.getValue() || [];
                    if (!items.length) return "N/A";
                    const first = items[0].title;
                    return items.length > 1 ? `<span>${first} <small style="color:var(--accent);">+${items.length - 1} extra</small></span>` : first;
                }},
                {title: "COUNTERPARTY", field: "customerName", widthGrow: 1.5, headerFilter: "input", formatter: (cell) => {
                    const d = cell.getData();
                    return `<div><strong>${d.customerName || 'UNKNOWN'}</strong><br><span class="dim-label" style="font-size:0.7rem;">${d.customerPhone || ''}</span></div>`;
                }},
                {title: "TRX_ID", field: "paymentTrxId", width: 140, headerFilter: "input", formatter: (cell) => `<span class="tabular" style="font-size:0.75rem;">${cell.getValue() || '--'}</span>`},
                {title: "VALUE", field: "amount", hozAlign: "right", width: 110, formatter: (cell) => `<span class="tabular semi-bold" style="color:var(--accent);">৳${(cell.getValue() || 0).toLocaleString()}</span>`},
                {title: "STATE", field: "status", hozAlign: "center", width: 130, headerFilter: "select", headerFilterParams: { values: true }, formatter: (cell) => {
                    const s = cell.getValue() || 'pending';
                    const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.pending;
                    return `<span class="status-pill-v2" style="--status-color: ${cfg.color}; --status-bg: ${cfg.bg};"><i class="ph ${cfg.icon}"></i> ${cfg.label}</span>`;
                }},
                {title: "SIGNAL", field: "createdAt", hozAlign: "center", width: 110, formatter: (cell) => {
                    const v = cell.getValue();
                    return v?.toDate ? v.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--';
                }},
                {title: "MANAGE", width: 100, hozAlign: "right", headerSort: false, formatter: (cell) => {
                    const d = cell.getData();
                    return `<button class="premium-btn primary manage-order-btn" data-order-id="${d.id}" style="padding:4px 10px; font-size:0.6rem;"><i class="ph ph-folder-open"></i> OPEN</button>`;
                }}
            ]
        });

        if (statusFilter === 'active') {
            ordersTable.setFilter("status", "in", ["pending", "confirmed", "in_progress", "shipped"]);
        } else if (statusFilter !== 'all') {
            ordersTable.setFilter("status", "=", statusFilter);
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function openOrderSheet(o) {
    const options = [
        { id: 'sheetConfirm', label: 'MARK ROUTED', icon: 'ph-corners-out', action: () => window.updateTerminalStatus(o.id, 'confirmed', o.fullPath) },
        { id: 'sheetProcess', label: 'MARK PROCESSING', icon: 'ph-gear-six', action: () => window.updateTerminalStatus(o.id, 'in_progress', o.fullPath) },
        { id: 'sheetDeliver', label: 'MARK SETTLED', icon: 'ph-check-circle', action: () => openOrderModal(o) }, // Fallback to modal for payload input
        { id: 'sheetCancel', label: 'VOID ORDER', icon: 'ph-prohibit', action: () => window.updateTerminalStatus(o.id, 'cancelled', o.fullPath) }
    ];

    utils.renderBottomSheet(`Order #${o.id.slice(0,8).toUpperCase()}`, options);
}

function openOrderModal(o) {
    console.log("Opening Modal for Order:", o.id);
    const modal = document.getElementById('orderModal');
    const body = document.getElementById('orderModalBody');
    if (!modal || !body) { console.error("Modal elements not found!"); return; }

    const cfg = STATUS_CONFIG[o.status || 'pending'];
    
    // Update header labels
    document.getElementById('orderModalTitle').textContent = `SIGNAL_LOG_${o.id.slice(0, 8).toUpperCase()}`;
    document.getElementById('orderModalSubtitle').textContent = `TERMINAL_NODE: ${o.id}`;

    const stages = ['pending', 'received', 'confirmed', 'in_progress', 'delivered'];
    const currentIdx = stages.indexOf(o.status || 'pending');

    // Partial Delivery Management
    const fulfillment = o.fulfillment || {};

    let operationalBlock = '';
    
    // SCENARIO 1: MANUAL PAYMENT VERIFICATION
    if (o.status === 'pending') {
        operationalBlock = `
            <div class="dashboard-section" style="border-color: var(--warning); background: rgba(245, 158, 11, 0.05);">
                <span class="section-label" style="color:var(--warning)">SCENARIO: PENDING_VERIFICATION</span>
                <p style="font-size:0.75rem; margin-bottom:16px;">This signal requires manual payment verification. Enter the Transaction ID from your payment terminal to confirm and log the verifier.</p>

                <div style="margin-bottom:14px;">
                    <span class="dim-label" style="font-size:0.65rem;">TRANSACTION_ID (from your terminal)</span>
                    <div style="display:flex; gap:8px; margin-top:6px;">
                        <input
                            id="verifyTrxInput"
                            type="text"
                            class="editable-input-v3"
                            placeholder="e.g. TRX-2024-XXXXXX"
                            value="${o.paymentTrxId || ''}"
                            style="flex:1; font-family:'JetBrains Mono',monospace; font-size:0.8rem;"
                        />
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <button class="premium-btn primary" onclick="window.verifyPaymentWithTrx('${o.id}', '${o.fullPath}')" style="background:var(--accent); color:#000;">
                        <i class="ph ph-shield-check"></i> VERIFY &amp; MARK RECEIVED
                    </button>
                    <button class="premium-btn" onclick="window.updateTerminalStatus('${o.id}', 'cancelled', '${o.fullPath}')" style="background:var(--danger); border:none; color:#fff;">
                        <i class="ph ph-prohibit"></i> VOID_SIGNAL
                    </button>
                </div>

                <div style="margin-top:12px; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; font-size:0.7rem; color:var(--text-dim);">
                    <i class="ph ph-info"></i> Verifier will be logged as: <strong style="color:var(--text-main);">${window.CuteState?.user?.email || 'Unknown'}</strong>
                </div>
            </div>
        `;
    } 
    // SCENARIO 2: ROUTING & PROCESSING
    else if (o.status === 'received' || o.status === 'confirmed' || o.status === 'in_progress') {
        operationalBlock = `
            <div class="dashboard-section">
                <span class="section-label">SCENARIO: FULFILLMENT_PREP</span>
                <div style="margin-bottom:12px;">
                    <span class="dim-label" style="font-size:0.6rem;">QUICK_COMM_RESPONSE</span>
                    <select id="predefinedMessageSelect" class="editable-input-v3" style="font-size:0.7rem; padding:8px;" onchange="document.getElementById('deliveryInfoInput').value = this.value">
                        <option value="">-- SELECT_TEMPLATE --</option>
                        <option value="PAYMENT_RECEIVED: Verified. Our admins are processing your order. Est: 15-30m.">Verified (Pending)</option>
                        <option value="WORK_IN_PROGRESS: Order is on the bench. Verifying credentials and preparing delivery.">Processing</option>
                        <option value="MAINTENANCE: Maintenance in progress. Delay expected.">Maintenance</option>
                    </select>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div>
                        <span class="dim-label" style="font-size:0.6rem;">TIMESTAMP_UPLINK</span>
                        <select id="estimatedTimeSelect" class="editable-input-v3">
                            <option value="ASAP" ${o.estimatedTime === 'ASAP' ? 'selected' : ''}>IMMEDIATE</option>
                            <option value="30m" ${o.estimatedTime === '30m' ? 'selected' : ''}>30_MINS</option>
                            <option value="1h" ${o.estimatedTime === '1h' ? 'selected' : ''}>01_HOUR</option>
                            <option value="4h" ${o.estimatedTime === '4h' ? 'selected' : ''}>04_HOURS</option>
                        </select>
                    </div>
                    <div style="display:flex; align-items:flex-end;">
                        <button class="premium-btn primary" style="width:100%; height:46px;" onclick="window.updateTerminalStatus('${o.id}', 'confirmed', '${o.fullPath}', document.getElementById('estimatedTimeSelect').value)">
                            <i class="ph ph-broadcast"></i> BROADCAST_UPDATE
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    body.innerHTML = `
        <div class="modal-main-column">
            <!-- 1. Lifecycle Pipeline -->
            <div class="dashboard-section">
                <span class="section-label">OPERATIONAL_PIPELINE</span>
                <div class="progress-line">
                    ${stages.map((s, i) => {
                        const stepCfg = STATUS_CONFIG[s];
                        let stateClass = '';
                        if (i < currentIdx) stateClass = 'complete';
                        else if (i === currentIdx) stateClass = 'active';
                        
                        return `
                            <div class="progress-node ${stateClass}" title="${stepCfg.label}" onclick="window.updateTerminalStatus('${o.id}', '${s}', '${o.fullPath}')">
                                <i class="ph ${stepCfg.icon}"></i>
                                <div style="position:absolute; top:40px; font-size:0.6rem; white-space:nowrap; font-weight:800; color:${stateClass ? 'var(--accent)' : 'var(--text-dim)'}">${stepCfg.label}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${operationalBlock}

            <!-- 2. Payload Distribution & Partial Delivery -->
            <div class="dashboard-section">
                <span class="section-label">ASSET_SETTLEMENT (PARTIAL_ALLOWED)</span>
                <div style="border:1px solid var(--border); border-radius:12px; overflow:hidden; background:rgba(0,0,0,0.2);">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead style="background:rgba(255,255,255,0.02);">
                            <tr>
                                <th style="text-align:left; padding:12px;">ASSET</th>
                                <th style="text-align:right; padding:12px;">SETTLE_ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(o.items || []).map((i, idx) => {
                                const itemFulfilled = fulfillment[i.uniqueId || i.id || idx]?.status === 'delivered';
                                return `
                                <tr style="border-top:1px solid var(--border);">
                                    <td style="padding:12px;">
                                        <div style="font-weight:700;">${i.title}</div>
                                        <div style="font-size:0.65rem; color:var(--text-dim)">${i.variant} x${i.quantity}</div>
                                        ${itemFulfilled ? `<div style="color:var(--success); font-weight:800; font-size:0.6rem; margin-top:4px;">[SETTLED]</div>` : ''}
                                    </td>
                                    <td style="text-align:right; padding:12px;">
                                        ${!itemFulfilled ? `
                                            <button class="pill" style="font-size:0.6rem;" onclick="window.showItemSettleFlow('${o.id}', '${o.fullPath}', ${idx})">
                                                DELIVER_ASSET
                                            </button>
                                        ` : `
                                            <i class="ph ph-check-circle" style="color:var(--success); font-size:1.2rem;"></i>
                                        `}
                                    </td>
                                </tr>
                                <tr id="settleRow_${idx}" style="display:none; background:rgba(0,201,188,0.05);">
                                    <td colspan="2" style="padding:12px;">
                                        <div style="font-size:0.65rem; color:var(--text-dim); margin-bottom:8px;"><i class="ph ph-lock-key"></i> Provide securely generated credentials for each unit (${i.quantity} units).</div>
                                        <div id="payloadContainer_${idx}" style="display:flex; flex-direction:column; gap:10px;">
                                            ${Array.from({length: i.quantity || 1}).map((_, uIdx) => `
                                                <div style="display:flex; gap:8px; align-items:flex-start;">
                                                    <span style="font-size:0.6rem; color:var(--accent); font-weight:800; margin-top:10px;">#${uIdx + 1}</span>
                                                    <textarea id="payload_${idx}_${uIdx}" class="editable-input-v3 unit-payload-${idx}" rows="2" placeholder="Unit ${uIdx + 1} Credentials..." style="font-size:0.75rem;"></textarea>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                                            <button class="action-btn-v2" onclick="document.getElementById('settleRow_${idx}').style.display='none'"><i class="ph ph-x"></i></button>
                                            <button class="premium-btn primary" style="font-size:0.65rem; padding:6px 16px; height:auto;" onclick="window.settleItemPartial('${o.id}', '${o.fullPath}', ${idx}, ${i.quantity || 1})">SETTLE_UNITS_SECURELY</button>
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top:24px;">
                    <span class="section-label">GLOBAL_OVERRIDE_SETTLEMENT</span>
                    <textarea id="deliveryInfoInput" class="editable-input-v3" rows="4" placeholder="Settle ALL remaining assets with this keyset...">${o.deliveryInfo || ''}</textarea>
                    <button class="premium-btn" style="width:100%; background:var(--success); color:#000; margin-top:12px;" onclick="window.deliverSignalPayload('${o.id}', '${o.fullPath}')">
                        <i class="ph ph-check-double"></i> SETTLE_ENTIRE_ORDER
                    </button>
                </div>
            </div>
        </div>

        <div class="modal-sidebar-column">
            <!-- 4. Counterparty Intel -->
            <div class="dashboard-section">
                <span class="section-label">COUNTERPARTY_ID</span>
                <div style="font-size:0.8rem;">
                    <div style="margin-bottom:12px;">
                        <div class="dim-label" style="font-size:0.6rem;">LEGAL_NAME</div>
                        <div style="font-weight:800; color:var(--text-main);">${o.customerName}</div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <div class="dim-label" style="font-size:0.6rem;">COMM_UPLINK</div>
                        <div style="font-family:monospace;">${o.customerPhone || 'N/A'}</div>
                        <div style="font-family:monospace; font-size:0.7rem;">${o.customerEmail || ''}</div>
                    </div>
                    <div>
                        <div class="dim-label" style="font-size:0.6rem;">TRX_IDENTIFIER</div>
                        <div style="font-family:monospace; color:var(--accent);">${o.paymentTrxId || 'NONE'}</div>
                        <div style="font-size:0.7rem; color:var(--text-dim);">${o.paymentMethod || 'DIRECT'}</div>
                    </div>
                </div>
            </div>

            <!-- 5. Audit Log -->
            <div class="dashboard-section" style="flex:1;">
                <span class="section-label">LIFECYCLE_LOG</span>
                <div class="history-container">
                    ${(o.history || []).reverse().map((h, i) => `
                        <div class="history-item ${i === 0 ? 'active' : ''}">
                            <span class="history-time">${h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString() : new Date(h.timestamp).toLocaleString()}</span>
                            <div style="font-weight:800; color:${STATUS_CONFIG[h.status]?.color || '#fff'}">${h.status.toUpperCase()}</div>
                            <div style="font-size:0.65rem; color:var(--text-dim);">BY: ${h.by || 'SYSTEM'}</div>
                        </div>
                    `).join('')}
                    ${!(o.history?.length) ? '<div class="dim-label">No log entries found.</div>' : ''}
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

window.showItemSettleFlow = (id, path, idx) => {
    const row = document.getElementById(`settleRow_${idx}`);
    if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
};

window.settleItemPartial = async (id, path, idx, qty) => {
    let payloads = [];
    for(let i=0; i<qty; i++) {
        const p = document.getElementById(`payload_${idx}_${i}`).value.trim();
        if (p) payloads.push(`Unit ${i+1}: ${p}`);
    }
    
    const payload = payloads.join('\n');
    if (!payload && qty > 0) { showToast('At least one unit credential required.', 'warning'); return; }

    try {
        const batch = writeBatch(db);
        const orderSnap = await getDoc(doc(db, 'orders', id));
        if (!orderSnap.exists()) return;
        const o = orderSnap.data();
        
        const fulfillment = o.fulfillment || {};
        const items = o.items || [];
        const item = items[idx];
        const itemId = item.uniqueId || item.id || idx;

        fulfillment[itemId] = {
            status: 'delivered',
            payload,
            deliveredAt: new Date()
        };

        // Check if all items are now delivered
        const allDelivered = items.every((_, i) => fulfillment[items[i].uniqueId || items[i].id || i]?.status === 'delivered');
        
        const updateData = {
            fulfillment,
            status: allDelivered ? 'delivered' : 'partial',
            updatedAt: serverTimestamp(),
            history: arrayUnion({ 
                status: allDelivered ? 'delivered' : 'partial', 
                timestamp: new Date(), 
                by: window.CuteState?.user?.email || 'SYSTEM',
                msg: `Item Settled: ${item.title}`
            })
        };

        batch.update(doc(db, path), updateData);
        batch.update(doc(db, 'orders', id), updateData);
        
        await batch.commit();
        showToast(`Item Settled: ${item.title}`, 'success');
        
        // Refresh modal
        const refreshed = await getDoc(doc(db, 'orders', id));
        openOrderModal({ ...refreshed.data(), id, fullPath: path });
        loadOrdersTerminal();
    } catch (e) {
        console.error(e);
        showToast('Settlement Failed', 'error');
    }
};

window.updateTerminalStatus = async (id, status, path, estimatedTime = null) => {
    try {
        const batch = writeBatch(db);
        const updateData = {
            status,
            updatedAt: serverTimestamp(),
            history: arrayUnion({ status, timestamp: new Date(), by: window.CuteState?.user?.email || 'SYSTEM' })
        };

        if (estimatedTime) {
            updateData.estimatedTime = estimatedTime;
        }
        
        // Update nested archival doc
        batch.update(doc(db, path), updateData);
        
        // Synchronize with primary root doc
        batch.update(doc(db, 'orders', id), updateData);

        // Manual Stock Reduction on Commitment (Confirmation)
        if (status === 'confirmed') {
            const orderSnap = await getDoc(doc(db, 'orders', id));
            const o = orderSnap.exists() ? orderSnap.data() : null;
            if (o) {
                const items = o.items || [];
                for (const item of items) {
                    const invId = item.productId || item.id;
                    if (invId) {
                        batch.update(doc(db, 'inventory', invId), {
                            stock: increment(-(item.quantity || 1)),
                            updatedAt: serverTimestamp()
                        });
                    }
                }
            }
        }

        await batch.commit();
        showToast('Stream Updated', 'success');
        
        // Re-open/Refresh modal if it was open
        const orderSnap = await getDoc(doc(db, 'orders', id));
        if (orderSnap.exists()) openOrderModal({ ...orderSnap.data(), id, fullPath: path });
        
        loadOrdersTerminal();
    } catch (e) { 
        console.error(e);
        showToast('Update Interrupted', 'error'); 
    }
};

window.deliverSignalPayload = async (id, path) => {
    const payload = document.getElementById('deliveryInfoInput').value;
    const estTime = document.getElementById('estimatedTimeSelect')?.value;
    
    try {
        const batch = writeBatch(db);
        const updateData = {
            status: 'delivered',
            deliveryInfo: payload,
            estimatedTime: estTime || 'Settled',
            updatedAt: serverTimestamp(),
            history: arrayUnion({ status: 'delivered', timestamp: new Date(), by: window.CuteState?.user?.email || 'SYSTEM' })
        };
        
        batch.update(doc(db, path), updateData);
        batch.update(doc(db, 'orders', id), updateData);
        
        await batch.commit();
        showToast('Payload Settled', 'success');
        
        // Refresh view
        const orderSnap = await getDoc(doc(db, 'orders', id));
        if (orderSnap.exists()) openOrderModal({ ...orderSnap.data(), id, fullPath: path });
        
        loadOrdersTerminal();
    } catch (e) { 
        console.error(e);
        showToast('Uplink Failed', 'error'); 
    }
};

// Delegated click handler for MANAGE buttons in the table
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.manage-order-btn');
    if (!btn) return;
    const orderId = btn.dataset.orderId;
    if (!orderId) return;
    try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) openOrderModal({ ...snap.data(), id: orderId, fullPath: snap.ref.path });
    } catch (err) {
        console.error('[Orders] Failed to open order modal:', err);
    }
});

// Verify payment with TrxID and log to finance_verifications
window.verifyPaymentWithTrx = async (orderId, path) => {
    const txnInput = document.getElementById('verifyTrxInput');
    const txnId = txnInput?.value?.trim();
    if (!txnId) {
        showToast('Please enter the Transaction ID from your terminal.', 'warning');
        return;
    }

    const verifiedBy = window.CuteState?.user?.email || 'SYSTEM';

    try {
        const batch = writeBatch(db);
        const updateData = {
            status: 'received',
            paymentTrxId: txnId,
            paymentVerifiedBy: verifiedBy,
            paymentVerifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            history: arrayUnion({
                status: 'received',
                timestamp: new Date(),
                by: verifiedBy,
                msg: `Payment verified. TRX: ${txnId}`
            })
        };

        batch.update(doc(db, path), updateData);
        batch.update(doc(db, 'orders', orderId), updateData);
        await batch.commit();

        // Log to finance_verifications collection
        await addDoc(collection(db, 'finance_verifications'), {
            orderId,
            txnId,
            verifiedBy,
            verifiedAt: serverTimestamp(),
            orderPath: path,
        });

        showToast(`Payment Verified ✓ TRX: ${txnId}`, 'success');

        // Refresh modal
        const refreshed = await getDoc(doc(db, 'orders', orderId));
        if (refreshed.exists()) openOrderModal({ ...refreshed.data(), id: orderId, fullPath: path });
        loadOrdersTerminal();
    } catch (err) {
        console.error('[Orders] Payment verification failed:', err);
        showToast('Verification Failed: ' + err.message, 'error');
    }
};

function setupOrdersUI() {
    document.getElementById('refreshOrdersBtn').onclick = () => loadOrdersTerminal();
    document.getElementById('closeOrderModal').onclick = () => {
        document.getElementById('orderModal').classList.remove('active');
    };

    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        printBtn.onclick = () => {
             const title = document.getElementById('orderModalTitle').textContent;
             const id = document.getElementById('orderModalSubtitle').textContent.replace('NODE_ID: #', '');
             if (window.prepareReceipt) window.prepareReceipt(id);
             else showToast('Receipt engine not loaded on this node.', 'warning');
        };
    }
    
    document.getElementById('timeFilterSelect').onchange = (e) => loadOrdersTerminal('all', e.target.value);

    document.getElementById('exportOrdersBtn').onclick = () => {
        if (ordersTable) ordersTable.download("csv", `orders_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    };

    document.getElementById('bulkSettleBtn').onclick = async () => {
        const selected = ordersTable.getSelectedData();
        if (confirm(`SETTLE_SELECTED: Process ${selected.length} transactions as DELIVERED?`)) {
            const batch = writeBatch(db);
            selected.forEach(o => {
                const updateData = {
                    status: 'delivered',
                    updatedAt: serverTimestamp(),
                    history: arrayUnion({ status: 'delivered', timestamp: new Date(), by: window.CuteState.user.email })
                };
                batch.update(doc(db, o.fullPath), updateData);
                batch.update(doc(db, 'orders', o.id), updateData);
            });
            await batch.commit();
            showToast(`SETTLED: ${selected.length} signals synchronized.`, "success");
            loadOrdersTerminal();
        }
    };

    document.querySelectorAll('.pill[data-status]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadOrdersTerminal(btn.dataset.status);
        }
    });
}
