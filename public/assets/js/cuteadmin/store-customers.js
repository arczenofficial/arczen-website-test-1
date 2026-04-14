/**
 * Store Customer Analytics Dashboard — Founder & Super-Admin Only
 *
 * Displays:
 *  - KPI strip with date-range filter (24h / 7d / 30d / custom)
 *  - Paginated user table with search
 *  - Per-user activity timeline drawer
 *  - Charts: registration trend, top actions doughnut
 */

import { db } from './db.js';
import {
    collection, getDocs, query, orderBy, limit, where,
    Timestamp, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── State ─────────────────────────────────────────────────────────────────
var currentRange = '7d';
var allUsers = [];
var searchQuery = '';
var currentPage = 1;
var PAGE_SIZE = 15;

var EVENT_ICONS = {
    login: '🔑', logout: '🚪', register: '🎉', profile_updated: '✏️',
    settings_updated: '⚙️', profile_viewed: '👤',
    password_changed: '🔒', password_reset_requested: '📧',
    order_placed: '📦', order_viewed: '🧾',
    checkout_started: '🛒', checkout_completed: '✅',
    cart_added: '➕', cart_removed: '➖',
    wishlist_added: '❤️', wishlist_removed: '💔',
    page_viewed: '👁️', product_viewed: '🔍', product_searched: '🔎',
    address_added: '📍', address_updated: '📍', address_deleted: '🗑️',
};

var RANGE_LABELS = { '24h': '24 Hours', '7d': '7 Days', '30d': '30 Days', 'custom': 'Custom Range' };

// ── Main entry ────────────────────────────────────────────────────────────
export async function renderStoreCustomersPage() {
    var content = document.getElementById('mainContentArea');
    if (!content) return;

    var role = window.CuteState.role;
    if (role !== 'founder' && role !== 'super_admin') {
        content.innerHTML = `
            <div style="padding:100px; text-align:center;">
                <i class="ph ph-lock-keyhole" style="font-size:4rem; color:var(--danger);"></i>
                <h2 style="margin-top:24px; color:var(--danger);">RESTRICTED</h2>
                <p class="dim-label">User analytics is restricted to founders.</p>
            </div>`;
        return;
    }

    // Reset state on each navigation
    allUsers = [];
    searchQuery = '';
    currentPage = 1;

    content.innerHTML = `
    <div class="module-container animate-fade-in" style="padding:28px;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:28px; flex-wrap:wrap; gap:16px;">
            <div>
                <h2 style="font-size:1.6rem; font-weight:900; margin:0; letter-spacing:-0.02em;">User Analytics</h2>
                <p style="color:var(--text-muted); font-size:0.85rem; margin:4px 0 0;">Real-time store customer insights &middot; Founder View</p>
            </div>
            <!-- Date Range Filter -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <button class="range-btn active-range" data-range="24h" style="padding:7px 16px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--text-dim); font-weight:700; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">24 Hours</button>
                <button class="range-btn active-range selected" data-range="7d" style="padding:7px 16px; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:var(--bg-deep); font-weight:700; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">7 Days</button>
                <button class="range-btn active-range" data-range="30d" style="padding:7px 16px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--text-dim); font-weight:700; font-size:0.8rem; cursor:pointer; transition:all 0.2s;">30 Days</button>
                <div style="display:flex; gap:4px; align-items:center; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:8px; padding:4px 8px;">
                    <span style="font-size:0.72rem; color:var(--text-dim); white-space:nowrap;">Custom:</span>
                    <input type="date" id="customFrom" style="background:none; border:none; color:var(--text-main); font-size:0.8rem; outline:none; width:110px;">
                    <span style="color:var(--text-dim);">&#8594;</span>
                    <input type="date" id="customTo" style="background:none; border:none; color:var(--text-main); font-size:0.8rem; outline:none; width:110px;">
                    <button id="applyCustomRange" style="padding:4px 8px; background:var(--accent); color:var(--bg-deep); border:none; border-radius:6px; font-weight:800; font-size:0.72rem; cursor:pointer;">Go</button>
                </div>
            </div>
        </div>

        <!-- KPI Strip -->
        <div id="kpiStrip" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:28px;">
            <div class="premium-card" style="padding:20px; text-align:center; min-height:100px; display:flex; align-items:center; justify-content:center;"><div class="spinner"></div></div>
            <div class="premium-card" style="padding:20px; text-align:center; min-height:100px; display:flex; align-items:center; justify-content:center;"><div class="spinner"></div></div>
            <div class="premium-card" style="padding:20px; text-align:center; min-height:100px; display:flex; align-items:center; justify-content:center;"><div class="spinner"></div></div>
            <div class="premium-card" style="padding:20px; text-align:center; min-height:100px; display:flex; align-items:center; justify-content:center;"><div class="spinner"></div></div>
            <div class="premium-card" style="padding:20px; text-align:center; min-height:100px; display:flex; align-items:center; justify-content:center;"><div class="spinner"></div></div>
        </div>

        <!-- Charts Row -->
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:20px; margin-bottom:28px;">
            <div class="premium-card" style="padding:20px;">
                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); letter-spacing:0.1em; margin-bottom:16px;">Registration Trend (Last 14 Days)</div>
                <canvas id="regTrendChart" height="180"></canvas>
            </div>
            <div class="premium-card" style="padding:20px;">
                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); letter-spacing:0.1em; margin-bottom:16px;">Top Event Types</div>
                <canvas id="topActionsChart" height="180"></canvas>
            </div>
        </div>

        <!-- User Table -->
        <div class="premium-card" style="padding:20px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px; flex-wrap:wrap;">
                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); letter-spacing:0.1em;">All Store Customers</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <input id="userSearch" type="search" placeholder="Search by name or email..." style="padding:8px 14px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:8px; color:var(--text-main); font-size:0.82rem; outline:none; width:240px;">
                    <span id="userCount" style="font-size:0.72rem; color:var(--text-dim); white-space:nowrap;"></span>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table id="usersTable" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border);">
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">User</th>
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">Email</th>
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">Joined</th>
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">Last Login</th>
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">Orders</th>
                            <th style="padding:12px 10px; text-align:left; font-size:0.65rem; text-transform:uppercase; font-weight:900; color:var(--text-dim); letter-spacing:0.08em;">Status</th>
                            <th style="padding:12px 10px;"></th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr><td colspan="7" style="padding:40px; text-align:center; color:var(--text-dim);">
                            <div class="spinner" style="margin:0 auto 12px;"></div>Loading users...
                        </td></tr>
                    </tbody>
                </table>
            </div>
            <div id="pagination" style="display:flex; gap:8px; justify-content:center; margin-top:16px; flex-wrap:wrap;"></div>
        </div>
    </div>

    <!-- Activity Drawer -->
    <div id="activityDrawer" style="position:fixed; top:0; right:-480px; width:480px; max-width:100vw; height:100vh; background:var(--bg-surface); border-left:1px solid var(--border); z-index:1000; box-shadow:-20px 0 60px rgba(0,0,0,0.6); overflow-y:auto; transition:right 0.4s cubic-bezier(0.22,1,0.36,1); padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h3 id="drawerUserName" style="margin:0; font-size:1.1rem; font-weight:900;">User Activity</h3>
                <div id="drawerUserEmail" style="font-size:0.72rem; color:var(--text-dim); margin-top:4px;"></div>
            </div>
            <button id="closeDrawer" style="background:none; border:none; color:var(--text-dim); font-size:1.8rem; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <div id="drawerStats" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:20px;"></div>
        <div style="font-size:0.65rem; text-transform:uppercase; font-weight:800; color:var(--text-dim); letter-spacing:0.1em; margin-bottom:12px;">Activity Timeline</div>
        <div id="drawerTimeline"></div>
    </div>
    <div id="drawerOverlay" style="display:none; position:fixed; inset:0; z-index:999; background:rgba(0,0,0,0.5);"></div>
    `;

    // Inject styles
    if (!document.getElementById('sc-styles')) {
        var style = document.createElement('style');
        style.id = 'sc-styles';
        style.textContent = `
            .spinner { width:28px; height:28px; border:3px solid rgba(0,201,188,0.15); border-top-color:var(--accent); border-radius:50%; animation:sc-spin 0.8s linear infinite; }
            @keyframes sc-spin { to { transform:rotate(360deg); } }
            .user-row { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.2s; cursor:pointer; }
            .user-row:hover { background:rgba(0,201,188,0.04); }
            .user-avatar { width:34px; height:34px; border-radius:8px; object-fit:cover; border:1px solid var(--border); }
            .status-badge { display:inline-block; padding:3px 8px; border-radius:6px; font-size:0.65rem; font-weight:700; }
            .status-active { background:rgba(16,185,129,0.1); color:#34d399; }
            .status-inactive { background:rgba(255,255,255,0.05); color:var(--text-dim); }
            .page-btn { padding:5px 10px; border-radius:6px; border:1px solid var(--border); background:transparent; color:var(--text-dim); cursor:pointer; font-size:0.8rem; font-weight:700; transition:0.2s; }
            .page-btn.active { background:var(--accent); color:var(--bg-deep); border-color:var(--accent); }
            .page-btn:hover { border-color:var(--accent); color:var(--accent); }
            .timeline-event { display:flex; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.03); }
            .timeline-icon { width:32px; height:32px; border-radius:8px; background:rgba(0,201,188,0.08); border:1px solid rgba(0,201,188,0.15); display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0; }
            .timeline-type { font-size:0.78rem; font-weight:800; text-transform:capitalize; }
            .timeline-meta { font-size:0.68rem; color:var(--text-dim); margin-top:2px; }
            .timeline-time { font-size:0.65rem; color:var(--text-dim); white-space:nowrap; }
        `;
        document.head.appendChild(style);
    }

    // Range buttons
    document.querySelectorAll('.range-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            currentRange = btn.dataset.range;
            document.querySelectorAll('.range-btn').forEach(function(b) {
                b.style.background = 'transparent';
                b.style.color = 'var(--text-dim)';
                b.style.borderColor = 'var(--border)';
            });
            btn.style.background = 'var(--accent)';
            btn.style.color = 'var(--bg-deep)';
            btn.style.borderColor = 'var(--accent)';
            refreshDashboard();
        });
    });

    document.getElementById('applyCustomRange')?.addEventListener('click', function() {
        currentRange = 'custom';
        refreshDashboard();
    });

    document.getElementById('userSearch')?.addEventListener('input', function(e) {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1;
        renderUserTable();
    });

    document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
    document.getElementById('drawerOverlay')?.addEventListener('click', closeDrawer);

    await refreshDashboard();
}

function getDateRange() {
    var now = new Date();
    var from;

    if (currentRange === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (currentRange === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (currentRange === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
        var fromEl = document.getElementById('customFrom');
        var toEl = document.getElementById('customTo');
        var fromVal = fromEl ? fromEl.value : '';
        var toVal = toEl ? toEl.value : '';
        from = fromVal ? new Date(fromVal) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        var to = toVal ? new Date(toVal + 'T23:59:59') : now;
        return { from: from, to: to };
    }
    return { from: from, to: now };
}

async function refreshDashboard() {
    await Promise.all([loadUsersTable(), loadKPIs()]);
}

async function loadUsersTable() {
    try {
        var customersSnap = await getDocs(
            query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(500))
        );

        var activityMap = {};
        try {
            var activitySnap = await getDocs(collection(db, 'user_activity_logs'));
            activitySnap.docs.forEach(function(d) { activityMap[d.id] = d.data(); });
        } catch (actErr) {
            console.warn('[StoreCustomers] Could not load activity summaries (permission or network issue). Defaulting to empty.', actErr);
        }

        allUsers = customersSnap.docs.map(function(d) {
            var data = d.data();
            var act = activityMap[d.id] || {};
            return {
                id: d.id,
                name: data.name || data.firstName || 'Unknown',
                email: data.email || '',
                createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null,
                lastLogin: act.lastLogin && act.lastLogin.toDate ? act.lastLogin.toDate() : null,
                totalOrders: data.totalOrders || act.totalOrders || 0,
                isActive: data.isActive !== false,
                photoUrl: data.photoUrl || null,
            };
        });

        var countEl = document.getElementById('userCount');
        if (countEl) countEl.textContent = allUsers.length + ' customers';
        renderUserTable();
    } catch (err) {
        console.error('[StoreCustomers] Load error:', err);
    }
}

function fmtDate(d) {
    if (!d) return '—';
    return d.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderUserTable() {
    var filtered = allUsers.filter(function(u) {
        if (!searchQuery) return true;
        return u.name.toLowerCase().includes(searchQuery) || u.email.toLowerCase().includes(searchQuery);
    });

    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = 1;

    var paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    var tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (paged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:40px; text-align:center; color:var(--text-dim);">No users found.</td></tr>';
    } else {
        tbody.innerHTML = paged.map(function(u) {
            var ava = u.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name) + '&background=0f171c&color=00C9BC';
            return '<tr class="user-row" onclick="window._scOpenDrawer(\'' + u.id + '\')">' +
                '<td style="padding:10px;"><div style="display:flex;align-items:center;gap:10px;"><img class="user-avatar" src="' + ava + '" alt=""><span style="font-weight:700;">' + u.name + '</span></div></td>' +
                '<td style="padding:10px; color:var(--text-dim);">' + u.email + '</td>' +
                '<td style="padding:10px; color:var(--text-dim); font-size:0.78rem;">' + fmtDate(u.createdAt) + '</td>' +
                '<td style="padding:10px; color:var(--text-dim); font-size:0.78rem;">' + fmtDate(u.lastLogin) + '</td>' +
                '<td style="padding:10px;"><span style="font-weight:800; color:' + (u.totalOrders > 0 ? 'var(--accent)' : 'var(--text-dim)') + ';">' + u.totalOrders + '</span></td>' +
                '<td style="padding:10px;"><span class="status-badge ' + (u.isActive ? 'status-active' : 'status-inactive') + '">' + (u.isActive ? 'Active' : 'Inactive') + '</span></td>' +
                '<td style="padding:10px;"><button class="pill" style="font-size:0.7rem;padding:5px 10px;" onclick="event.stopPropagation();window._scOpenDrawer(\'' + u.id + '\')"><i class="ph ph-activity"></i> View</button></td>' +
                '</tr>';
        }).join('');
    }

    // Pagination
    var pg = document.getElementById('pagination');
    if (!pg) return;
    if (totalPages <= 1) { pg.innerHTML = ''; return; }

    var html = '';
    if (currentPage > 1) html += '<button class="page-btn" onclick="window._scSetPage(' + (currentPage - 1) + ')">&#8592; Prev</button>';
    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="window._scSetPage(' + i + ')">' + i + '</button>';
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span style="padding:5px; color:var(--text-dim);">…</span>';
        }
    }
    if (currentPage < totalPages) html += '<button class="page-btn" onclick="window._scSetPage(' + (currentPage + 1) + ')">Next &#8594;</button>';
    pg.innerHTML = html;
}

window._scSetPage = function(p) { currentPage = p; renderUserTable(); };

async function loadKPIs() {
    var strip = document.getElementById('kpiStrip');
    if (!strip) return;

    var range = getDateRange();
    var from = range.from;
    var to = range.to;
    var fromTs = Timestamp.fromDate(from);
    var toTs = Timestamp.fromDate(to);

    try {
        const [regSnap, countSnap] = await Promise.all([
            getDocs(query(collection(db, 'customers'),
                where('createdAt', '>=', fromTs),
                where('createdAt', '<=', toTs))),
            getCountFromServer(collection(db, 'customers'))
        ]);
        
        var newRegs = regSnap.size;
        var totalCustomers = countSnap.data().count;

        var loginCount = 0;
        var activePurchasers = 0;
        var actionCounts = {};

        try {
            var actSnap = await getDocs(collection(db, 'user_activity_logs'));
            actSnap.docs.forEach(function(d) {
                var data = d.data();
                var ll = data.lastLogin && data.lastLogin.toDate ? data.lastLogin.toDate() : null;
                if (ll && ll >= from && ll <= to) loginCount++;
                if ((data.totalOrders || 0) > 0) activePurchasers++;
                if (data.lastAction) actionCounts[data.lastAction] = (actionCounts[data.lastAction] || 0) + 1;
            });
        } catch (actErr) {
            console.warn('[StoreCustomers] KPI activity load failed. Values will show 0.', actErr);
        }



        var kpis = [
            { label: 'New Registrations', val: newRegs, icon: 'ph-user-plus', color: '#10b981' },
            { label: 'Total Customers', val: totalCustomers, icon: 'ph-users', color: 'var(--accent)' },
            { label: 'Logins in Period', val: loginCount, icon: 'ph-sign-in', color: '#60a5fa' },
            { label: 'Have Ordered', val: activePurchasers, icon: 'ph-package', color: '#f59e0b' },
            { label: 'No Orders Yet', val: Math.max(0, totalCustomers - activePurchasers), icon: 'ph-hourglass', color: 'var(--text-dim)' },
        ];

        strip.innerHTML = kpis.map(function(k) {
            return '<div class="premium-card" style="padding:20px; text-align:center;">' +
                '<i class="ph ' + k.icon + '" style="font-size:1.5rem; color:' + k.color + ';"></i>' +
                '<div style="font-size:2rem; font-weight:900; margin:8px 0; color:' + k.color + ';">' + k.val.toLocaleString() + '</div>' +
                '<div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; color:var(--text-dim); letter-spacing:0.1em;">' + k.label + '</div>' +
                '</div>';
        }).join('');

        drawCharts(allUsers, actionCounts);
    } catch (err) {
        console.error('[StoreCustomers] KPI error:', err);
        if (strip) strip.innerHTML = '<div style="grid-column:1/-1; color:var(--danger); padding:20px;">Failed to load KPIs: ' + err.message + '</div>';
    }
}

async function drawCharts(users, actionCounts) {
    if (!window.Chart) {
        await new Promise(function(resolve) {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Registration trend
    var regCanvas = document.getElementById('regTrendChart');
    if (regCanvas && regCanvas.getContext) {
        var regCtx = regCanvas.getContext('2d');
        var days = 14;
        var labels = [];
        var counts = [];
        var todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        for (var i = 0; i < days; i++) counts.push(0);

        for (var di = days - 1; di >= 0; di--) {
            var d = new Date(todayStart.getTime() - di * 86400000);
            labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
        }

        users.forEach(function(u) {
            if (!u.createdAt) return;
            var dayDiff = Math.floor((todayStart.getTime() - u.createdAt.getTime()) / 86400000);
            if (dayDiff >= 0 && dayDiff < days) counts[days - 1 - dayDiff]++;
        });

        if (window._regChart) { try { window._regChart.destroy(); } catch(e) {} }
        window._regChart = new window.Chart(regCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'New Users', data: counts,
                    borderColor: '#00C9BC', backgroundColor: 'rgba(0,201,188,0.08)',
                    borderWidth: 2, fill: true, tension: 0.4,
                    pointBackgroundColor: '#00C9BC', pointRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#666', font: { size: 10 }, precision: 0 } }
                }
            }
        });
    }

    // Top actions doughnut
    var actCanvas = document.getElementById('topActionsChart');
    if (actCanvas && actCanvas.getContext) {
        var actCtx = actCanvas.getContext('2d');
        if (window._actChart) { try { window._actChart.destroy(); } catch(e) {} }

        if (Object.keys(actionCounts).length === 0) {
            actCtx.clearRect(0, 0, actCanvas.width, actCanvas.height);
            actCtx.font = "12px sans-serif";
            actCtx.fillStyle = "#666";
            actCtx.textAlign = "center";
            actCtx.textBaseline = "middle";
            actCtx.fillText("No Activity Data", actCanvas.width/2, actCanvas.height/2);
        } else {
            var entries = Object.entries(actionCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 7);
            var COLORS = ['#00C9BC','#c6a75e','#60a5fa','#f59e0b','#10b981','#f87171','#a78bfa'];

            window._actChart = new window.Chart(actCtx, {
                type: 'doughnut',
            data: {
                labels: entries.map(function(e) { return e[0].replace(/_/g, ' '); }),
                datasets: [{
                    data: entries.map(function(e) { return e[1]; }),
                    backgroundColor: COLORS, borderColor: 'var(--bg-deep)', borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#999', font: { size: 10 }, boxWidth: 10, padding: 8 } } },
                cutout: '65%',
            }
        });
        }
    }
}

// ── User Activity Drawer ──────────────────────────────────────────────────
window._scOpenDrawer = async function(uid) {
    var drawer = document.getElementById('activityDrawer');
    var overlay = document.getElementById('drawerOverlay');
    var timeline = document.getElementById('drawerTimeline');
    var drawerStats = document.getElementById('drawerStats');
    if (!drawer || !timeline) return;

    var user = null;
    for (var i = 0; i < allUsers.length; i++) {
        if (allUsers[i].id === uid) { user = allUsers[i]; break; }
    }
    if (!user) return;

    document.getElementById('drawerUserName').textContent = user.name;
    document.getElementById('drawerUserEmail').textContent = user.email;
    timeline.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-dim);"><div class="spinner" style="margin:0 auto 12px;"></div>Loading activity...</div>';

    if (drawerStats) {
        drawerStats.innerHTML = [
            { label: 'Orders', val: user.totalOrders, color: 'var(--accent)' },
            { label: 'Joined', val: user.createdAt ? user.createdAt.toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' }) : '—', color: 'var(--text-main)' },
            { label: 'Last Login', val: user.lastLogin ? user.lastLogin.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—', color: 'var(--text-main)' },
        ].map(function(s) {
            return '<div style="text-align:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--border);">' +
                '<div style="font-size:1rem; font-weight:900; color:' + s.color + ';">' + s.val + '</div>' +
                '<div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; color:var(--text-dim); margin-top:4px;">' + s.label + '</div>' +
                '</div>';
        }).join('');
    }

    overlay.style.display = 'block';
    setTimeout(function() { drawer.style.right = '0'; }, 10);

    try {
        var { query: q, collection: col, orderBy: ob, limit: lim, getDocs: gd } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        let eventsSnap;
        try {
            eventsSnap = await gd(q(col(db, 'user_activity_logs', uid, 'events'), ob('timestamp', 'desc'), lim(100)));
        } catch (actErr) {
            timeline.innerHTML = '<div style="text-align:center; padding:30px; color:var(--danger);">Insufficient permissions to view activity log. (Requires rules update)</div>';
            return;
        }

        if (eventsSnap.empty) {
            timeline.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-dim);">No activity recorded yet.</div>';
            return;
        }

        function fmtTs(ts) {
            if (!ts) return '—';
            var d2 = ts.toDate ? ts.toDate() : new Date(ts);
            return d2.toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        }

        timeline.innerHTML = eventsSnap.docs.map(function(docSnap) {
            var ev = docSnap.data();
            var icon = EVENT_ICONS[ev.type] || '📋';
            var metaParts = [];
            if (ev.ip) metaParts.push('IP: ' + ev.ip);
            if (ev.browser && ev.os) metaParts.push(ev.browser + '/' + ev.os);
            if (ev.page) metaParts.push('→ ' + ev.page);
            if (ev.orderId) metaParts.push('Order #' + ev.orderId.slice(0, 8));
            if (ev.productName) metaParts.push('🛍 ' + ev.productName);

            return '<div class="timeline-event">' +
                '<div class="timeline-icon">' + icon + '</div>' +
                '<div style="flex:1;">' +
                '<div class="timeline-type">' + (ev.type || '').replace(/_/g, ' ') + '</div>' +
                (metaParts.length ? '<div class="timeline-meta">' + metaParts.join(' · ') + '</div>' : '') +
                '</div>' +
                '<div class="timeline-time">' + fmtTs(ev.timestamp) + '</div>' +
                '</div>';
        }).join('');
    } catch (err) {
        timeline.innerHTML = '<div style="color:var(--danger); padding:20px;">Failed to load activity: ' + err.message + '</div>';
    }
};

function closeDrawer() {
    var drawer = document.getElementById('activityDrawer');
    var overlay = document.getElementById('drawerOverlay');
    if (drawer) drawer.style.right = '-480px';
    setTimeout(function() { if (overlay) overlay.style.display = 'none'; }, 400);
}
