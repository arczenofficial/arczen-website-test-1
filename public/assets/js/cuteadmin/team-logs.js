import {
    collection, getDocs, query, orderBy, limit, collectionGroup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

export async function renderTeamLogsPage() {
    const mainArea = document.getElementById('mainContentArea');
    if (!mainArea) return;

    mainArea.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">System Audit Logs</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Global Activity Stream & Forensic Terminal</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="exportLogsBtn" class="action-btn-v2"><i class="ph ph-export"></i></button>
                    <div class="terminal-badge" style="background:rgba(239, 68, 68, 0.1); color:var(--danger); border:1px solid var(--danger);">HIGH_COMMAND_ONLY</div>
                </div>
            </div>

            <!-- Audit Metrics -->
            <div class="metrics-strip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="mini-card">
                    <span class="label">TOTAL EVENTS</span>
                    <div class="val" id="totalLogs">--</div>
                </div>
                <div class="mini-card highlight-accent">
                    <span class="label">ADMIN ACTIONS</span>
                    <div class="val accent" id="adminActions">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">SECURITY FLAGS</span>
                    <div class="val crit" id="securityFlags">0</div>
                </div>
                <div class="mini-card">
                    <span class="label">SYSTEM UPTIME</span>
                    <div class="val" id="systemUptime">99.9%</div>
                </div>
            </div>

            <!-- Terminal Filters -->
            <div class="terminal-controls" style="display: flex; gap: 12px; margin-bottom: 24px;">
                <div class="search-box-v2" style="flex:1;">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="logSearch" placeholder="Query by User, Action, or Resource ID...">
                </div>
                <select id="logFilter" class="modern-select" style="max-width:200px; background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border); border-radius:8px; padding:0 12px;">
                    <option value="all">ALL ENTITIES</option>
                    <option value="order">ORDERS</option>
                    <option value="product">CATALOG</option>
                    <option value="auth">AUTHENTICATION</option>
                </select>
            </div>

            <div id="logsTerminalTable" style="background: var(--bg-surface); border-radius: 12px; height: 600px; overflow: hidden; border: 1px solid var(--border);"></div>
            
            <div id="logsLoader" class="terminal-loader" style="display:none;">
                <div class="scanner"></div>
                <span>Forensic buffer sync...</span>
            </div>
        </div>
    `;

    loadSystemLogs();
    setupLogFilters();
}

let logsTable = null;

async function loadSystemLogs() {
    const loader = document.getElementById('logsLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const snap = await getDocs(query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'), limit(200)));
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        document.getElementById('totalLogs').textContent = logs.length;
        document.getElementById('adminActions').textContent = logs.filter(l => l.role === 'super_admin' || l.role === 'founder').length;
        document.getElementById('securityFlags').textContent = logs.filter(l => (l.action || '').includes('DELETE')).length;

        if (logsTable) logsTable.destroy();

        logsTable = new Tabulator("#logsTerminalTable", {
            data: logs,
            layout: "fitColumns",
            height: "100%",
            columns: [
                {title: "TIMESTAMP", field: "timestamp", width: 180, cssClass: "tabular dim-label", formatter: (cell) => {
                    const v = cell.getValue();
                    return v?.toDate ? v.toDate().toLocaleString() : new Date(v).toLocaleString();
                }},
                {title: "ENTITY", field: "entity", width: 120, formatter: (cell) => `<span class="tag" style="background:rgba(255,255,255,0.05);">${cell.getValue() || 'SYSTEM'}</span>`},
                {title: "ACTION_DESCRIPTOR", field: "action", widthGrow: 2, formatter: (cell) => {
                    const a = cell.getValue() || 'Unknown';
                    let color = 'var(--text-main)';
                    if (a.includes('DELETE')) color = 'var(--danger)';
                    if (a.includes('CREATE')) color = 'var(--success)';
                    return `<span class="semi-bold" style="color:${color}">${a}</span>`;
                }},
                {title: "AUTHOR", field: "userName", width: 150, cssClass: "semi-bold"},
                {title: "METADATA", field: "details", hozAlign: "right", width: 100, headerSort: false, formatter: (cell) => {
                    return `<i class="ph ph-info dim-label" style="cursor:help;" title='${JSON.stringify(cell.getValue() || {})}'></i>`;
                }}
            ]
        });

    } catch (e) {
        console.error("Log Terminal Error:", e);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function setupLogFilters() {
    document.getElementById('logSearch')?.addEventListener('input', (e) => {
        if (logsTable) logsTable.setFilter("action", "like", e.target.value);
    });

    document.getElementById('logFilter')?.addEventListener('change', (e) => {
        if (logsTable) {
            if (e.target.value === 'all') {
                logsTable.clearFilter();
            } else {
                logsTable.setFilter("entity", "=", e.target.value);
            }
        }
    });

    document.getElementById('exportLogsBtn').onclick = () => {
        if (logsTable) logsTable.download("csv", `arczen_audit_log_${new Date().toISOString().slice(0,10)}.csv`);
    };
}
