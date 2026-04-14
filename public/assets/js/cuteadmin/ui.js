import { getEffectiveRole, getGlobalLogs, getSystemAuditLogs } from './db.js';
import { getTasks, getCompletedTasks, createTask, updateTask, deleteTask, getTaskStats } from './tasks.js';
import { getAllUsers, getTeamMembers } from './users.js';
import { getDashboardData } from './dashboard.js';
import { showToast, utils } from './utils.js';

// ── Permission-aware sidebar helpers ─────────────────────────────────────
function hasAccess(section, role, userProfile) {
    if (role === 'founder' || role === 'super_admin') return true;
    return userProfile?.permissions?.[section] === true;
}

function showIfCan(section, role, userProfile, html) {
    return hasAccess(section, role, userProfile) ? html : '';
}

function buildInventoryNav(role, userProfile) {
    const show = {
        products: hasAccess('products', role, userProfile),
        inventory: hasAccess('inventory', role, userProfile),
        orders: hasAccess('orders', role, userProfile),
        customers: hasAccess('customers', role, userProfile),
    };
    if (!Object.values(show).some(Boolean)) return '';
    return `
        <div class="nav-divider" style="height: 1px; background: var(--border); margin: 16px 8px;"></div>
        <p class="nav-section-label" style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; margin: 0 12px 8px; font-weight: 800;">Operations</p>
        ${show.products ? `<a href="#products" class="nav-item"><i class="ph ph-package"></i> <span>Catalog</span></a>` : ''}
        ${show.inventory ? `<a href="#inventory" class="nav-item"><i class="ph ph-warehouse"></i> <span>Warehouse</span></a>` : ''}
        ${show.orders ? `<a href="#orders" class="nav-item"><i class="ph ph-shopping-bag-open"></i> <span>Orders</span> <span class="nav-badge" id="orderBadge"></span></a>` : ''}
        ${show.customers ? `<a href="#store-customers" class="nav-item"><i class="ph ph-users"></i> <span>Customers</span></a>` : ''}
    `;
}

function buildFinanceNav(role, userProfile) {
    const show = {
        analytics: hasAccess('analytics', role, userProfile),
        finance: hasAccess('finance', role, userProfile),
    };
    if (!Object.values(show).some(Boolean)) return '';
    return `
        <div class="nav-divider" style="height: 1px; background: var(--border); margin: 16px 8px;"></div>
        <p class="nav-section-label" style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; margin: 0 12px 8px; font-weight: 800;">Financials</p>
        ${show.analytics ? `<a href="#analytics" class="nav-item"><i class="ph ph-chart-line-up"></i> <span>Analytics</span></a>` : ''}
        ${show.finance ? `<a href="#treasury" class="nav-item"><i class="ph ph-vault"></i> <span>Treasury</span></a>` : ''}
        ${show.finance ? `<a href="#finance" class="nav-item"><i class="ph ph-wallet"></i> <span>Accounting</span></a>` : ''}
    `;
}

function buildArchitectureNav(role, userProfile) {
    if (role !== 'founder' && role !== 'super_admin') return '';
    return `
        <div class="nav-divider" style="height: 1px; background: var(--border); margin: 16px 8px;"></div>
        <p class="nav-section-label" style="font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; margin: 0 12px 8px; font-weight: 800;">Architecture</p>
        <a href="#users" class="nav-item"><i class="ph ph-users-three"></i> <span>Staff Members</span></a>
        <a href="#logs" class="nav-item"><i class="ph ph-scroll"></i> <span>Logs</span></a>
        <a href="#import-csv" class="nav-item"><i class="ph ph-file-csv"></i> <span>Bulk Import</span></a>
        <a href="#system-settings" class="nav-item"><i class="ph ph-swatches"></i> <span>Settings</span></a>
        <a href="#ultimate" class="nav-item" style="color: var(--accent);"><i class="ph ph-crown"></i> <span>Equity Hub</span></a>
    `;
}

export function renderLoginPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="login-brand">
                    <img src="../assets/images/logo-placeholder.svg" alt="ArcZen Logo" class="login-logo">
                    <h2>ARCZEN</h2>
                    <p class="subtitle">Admin Portal</p>
                </div>
                
                <button type="button" id="googleSignInBtn" class="google-signin-btn">
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="evenodd"><path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"></path><path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"></path><path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"></path><path d="M9 18c2.43 0 4.47-.80 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.40-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"></path><path fill="none" d="M0 0h18v18H0z"></path></g></svg>
                    Sign in with Google
                </button>
                
                <div class="divider"><span>or</span></div>
                
                <form id="loginForm">
                    <div class="input-group">
                        <label>Email</label>
                        <input type="email" id="email" placeholder="your@arczen.store" required>
                    </div>
                    <div class="input-group">
                        <label>Password</label>
                        <input type="password" id="password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" id="loginBtn">Login with Email</button>
                </form>
                
                <div class="login-footer">
                    <a href="/" class="home-link"><i class="ph ph-house"></i> Visit Main Website</a>
                </div>
            </div>
        </div>
    `;
}

export function renderDashboardPage(user) {
    const realRole = window.CuteState.role || 'guest';
    const currentViewMode = window.CuteState.viewMode || realRole;
    const userProfile = window.CuteState.userProfile || {};
    const fxRate = window.CuteState.fxRate || 119.50;

    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) {
        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <img src="../assets/images/logo-placeholder.svg" alt="ArcZen">
                <span>ARCZEN BOARD</span>
            </div>
            
            <div class="sidebar-search-container">
                <div class="sidebar-search">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="moduleSearch" placeholder="EXEC_TERMINAL_FIND..." autocomplete="off">
                </div>
            </div>

            <nav class="sidebar-nav" id="sidebarNav">
                <a href="#dashboard" class="nav-item"><i class="ph ph-squares-four"></i> <span>Dashboard</span></a>
                ${showIfCan('tasks', currentViewMode, userProfile, `<a href="#projects" class="nav-item"><i class="ph ph-list-checks"></i> <span>Tasks</span></a>`)}
                ${showIfCan('attendance', currentViewMode, userProfile, `<a href="#attendance" class="nav-item"><i class="ph ph-calendar-check"></i> <span>Attendance</span></a>`)}
                ${showIfCan('points', currentViewMode, userProfile, `<a href="#points" class="nav-item"><i class="ph ph-medal"></i> <span>Points</span></a>`)}

                ${buildInventoryNav(currentViewMode, userProfile)}
                ${buildFinanceNav(currentViewMode, userProfile)}
                ${buildArchitectureNav(currentViewMode, userProfile)}
            </nav>

            <div class="sidebar-footer" style="padding: 12px; border-top: 1px solid var(--border);">
                <a href="#settings" class="nav-item"><i class="ph ph-user-circle"></i> <span>Profile</span></a>
                <button id="logoutBtn" class="nav-item" style="color: var(--danger); width: 100%; border: none; background: none; cursor: pointer;">
                    <i class="ph ph-sign-out"></i> <span>Exit System</span>
                </button>
            </div>
        `;
    }

    const topbar = document.getElementById('mainTopbar');
    if (topbar) {
        topbar.innerHTML = `
            <div class="topbar-left">
                <button id="sidebarToggle" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:24px; display:flex; align-items:center;"><i class="ph ph-list"></i></button>
                <div class="fx-ticker">
                    <span class="label">USD/BDT</span>
                    <span class="rate">৳${fxRate.toFixed(2)}</span>
                    <i class="ph ph-trend-up" style="font-size: 12px;"></i>
                </div>
            </div>
            <div class="topbar-right">
                <button id="quickAddBtn" style="background:var(--accent); color:var(--bg-deep); border:none; border-radius:6px; padding:6px 12px; font-weight:800; display:flex; align-items:center; gap:6px; cursor:pointer;"><i class="ph ph-plus-bold"></i> <span>NEW</span></button>
                <div class="user-profile" id="profileContainer" style="display:flex; align-items:center; gap:12px; cursor:pointer;">
                    <div style="text-align:right;">
                        <div style="font-size:0.85rem; font-weight:700;">${userProfile.name || 'Admin'}</div>
                        <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">${currentViewMode}</div>
                    </div>
                    <img src="${userProfile.photoUrl || 'https://ui-avatars.com/api/?name=Admin'}" style="width:36px; height:36px; border-radius:50%; border:2px solid var(--border);">
                    <div class="profile-dropdown" id="profileDropdown" style="display:none; position:absolute; top:60px; right:20px; background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; min-width:200px; box-shadow:var(--shadow-lg); z-index:1000;">
                        <div style="padding:16px; border-bottom:1px solid var(--border); font-weight:700;">${user.email}</div>
                        <button id="profileLogoutBtn" style="width:100%; border:none; background:none; padding:12px 16px; color:var(--danger); text-align:left; cursor:pointer; display:flex; align-items:center; gap:10px;"><i class="ph ph-power"></i> Secure Exit</button>
                    </div>
                </div>
            </div>
        `;
    }

    const mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) {
        mobileNav.innerHTML = `<a href="#dashboard" class="mobile-nav-item active"><i class="ph ph-squares-four"></i></a><a href="#orders" class="mobile-nav-item"><i class="ph ph-shopping-bag-open"></i></a><a href="#products" class="mobile-nav-item"><i class="ph ph-package"></i></a><a href="#finance" class="mobile-nav-item"><i class="ph ph-wallet"></i></a>`;
    }

    const logoutHandler = () => document.dispatchEvent(new CustomEvent('app:logout'));
    document.getElementById('logoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('profileLogoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('sidebarToggle')?.addEventListener('click', () => document.getElementById('mainSidebar').classList.toggle('collapsed'));
    
    const profileContainer = document.getElementById('profileContainer');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileContainer && profileDropdown) {
        profileContainer.addEventListener('click', (e) => { e.stopPropagation(); profileDropdown.style.display = profileDropdown.style.display === 'none' ? 'block' : 'none'; });
        document.addEventListener('click', () => profileDropdown.style.display = 'none');
    }

    const searchInput = document.getElementById('moduleSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.nav-item').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(query) ? 'flex' : 'none'; });
        });
    }
}

let dashboardCharts = {};

export async function renderDashboardContent() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    // Cleanup existing charts to prevent stretching/leaks
    Object.values(dashboardCharts).forEach(c => c && typeof c.destroy === 'function' && c.destroy());
    dashboardCharts = {};

    content.innerHTML = `
        <div class="dashboard-grid skeleton-active">
            <div style="grid-column: span 12; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
                <div><h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Operational Command</h2><p style="color:var(--text-muted); font-size:0.85rem;">Synchronizing with market...</p></div>
            </div>
            <div class="widget-row" style="grid-column: span 12; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
                ${[1, 2, 3, 4].map(() => `<div class="widget skeleton" style="height: 140px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px;"></div>`).join('')}
            </div>
        </div>
    `;

    try {
        const dashboardData = await getDashboardData().catch(err => {
            console.warn("[UI] Dashboard data degraded mode:", err);
            return { totalSales: 0, activeOrders: 0, pendingTasks: 0, netProfit: 0, salesGrowth: 0, profitGrowth: 0 };
        });

        const activity = [
            { type: 'order', title: 'New Signal Inbound', user: 'System', time: 'Just Now' },
            { type: 'project', title: 'Directive Updated', user: 'Zahin', time: '12m ago' },
            { type: 'finance', title: 'FX Divergence Detected', user: 'Bot', time: '1h ago' }
        ];

        content.innerHTML = `
            <div class="dashboard-grid animate-fade-in">
                <div style="grid-column: span 12; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
                    <div><h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Operational Command</h2><p style="color:var(--text-muted); font-size:0.85rem;">Terminal Active | Latency: 42ms</p></div>
                    <div style="font-family:'JetBrains Mono'; font-size:0.75rem; color:var(--text-dim);">LATEST REFRESH: ${new Date().toLocaleTimeString()}</div>
                </div>

                <div class="widget-row" style="grid-column: span 12; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px;">
                    <div class="widget premium-card" style="position:relative; overflow:hidden;">
                        <div class="widget-head"><span class="label">GROSS REVENUE</span><i class="ph ph-trend-up up"></i></div>
                        <div class="widget-body"><div class="value">৳${(dashboardData.totalSales / 1000).toFixed(1)}K</div><div class="sub"><span class="trend up">+${dashboardData.salesGrowth || 0}%</span> vs window</div></div>
                        <div style="height:60px; width:100%; position:absolute; bottom:0; left:0;"><canvas id="salesSparkline"></canvas></div>
                    </div>
                    <div class="widget premium-card" style="position:relative; overflow:hidden;">
                        <div class="widget-head"><span class="label">NET PROFIT</span><i class="ph ph-chart-pie"></i></div>
                        <div class="widget-body"><div class="value" style="color:var(--accent);">৳${(dashboardData.netProfit / 1000).toFixed(1)}K</div><div class="sub"><span class="trend ${dashboardData.profitGrowth > 0 ? 'up' : 'down'}">${dashboardData.profitGrowth > 0 ? '+' : ''}${dashboardData.profitGrowth || 0}%</span> efficiency</div></div>
                        <div style="height:60px; width:100%; position:absolute; bottom:0; left:0;"><canvas id="profitSparkline"></canvas></div>
                    </div>
                    <div class="widget premium-card">
                        <div class="widget-head"><span class="label">PENDING SIGNALS</span><i class="ph ph-broadcast"></i></div>
                        <div class="widget-body"><div class="value">${dashboardData.activeOrders || 0}</div><div class="sub">Awaiting Sourcing...</div></div>
                        <div class="progress-bar"><div class="fill" style="width: 65%;"></div></div>
                    </div>
                    <div class="widget premium-card">
                        <div class="widget-head"><span class="label">TASK BACKLOG</span><i class="ph ph-list-checks"></i></div>
                        <div class="widget-body"><div class="value">${dashboardData.pendingTasks || 0}</div><div class="sub">Active Directives</div></div>
                        <div style="margin-top:12px; display:flex; gap:8px;"><span class="tag crit">3 CRITICAL</span><span class="tag warn">5 NORMAL</span></div>
                    </div>
                </div>

                <div style="grid-column: span 12; display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                    <!-- Order Command & Stream Column -->
                    <div style="display: flex; flex-direction: column; gap: 24px;">
                        <!-- Order Command Widget (Quick Actions) -->
                        <div class="widget-container premium-card" style="padding:0; border-left: 4px solid var(--accent);">
                            <div class="container-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                <h3 style="margin:0; font-size:0.9rem;"><i class="ph ph-lightning" style="color:var(--accent);"></i> INSTANT_SETTLEMENT_CONTROL</h3>
                                <span class="tag" style="background:var(--accent-soft); color:var(--accent); font-size:0.6rem;">PRIORITY_ALPHA</span>
                            </div>
                            <div style="padding:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                                ${(dashboardData.recentOrders || []).filter(o => o.status === 'pending').slice(0, 4).map(o => `
                                    <div class="mini-card highlight" style="padding:12px; border:1px solid var(--border); background:rgba(0,0,0,0.2);">
                                        <div style="font-size:0.75rem; font-weight:800; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.customerName}</div>
                                        <div style="font-size:0.65rem; color:var(--text-dim); margin-bottom:8px;">${o.items?.[0]?.title || 'Signal Asset'}</div>
                                        <div style="display:flex; gap:6px;">
                                            <button onclick="window.updateTerminalStatus('${o.id}', 'confirmed')" class="pill" style="flex:1; font-size:0.6rem; padding:4px;">CONFIRM</button>
                                            <button onclick="window.updateTerminalStatus('${o.id}', 'delivered')" class="pill primary" style="flex:1; font-size:0.6rem; padding:4px;">DELIVER</button>
                                        </div>
                                    </div>
                                `).join('') || '<div class="dim-label" style="grid-column: span 12; text-align:center; padding:20px;">No pending signals requiring immediate settlement.</div>'}
                            </div>
                        </div>

                        <!-- Live Orders Stream -->
                        <div class="widget-container premium-card" style="padding:0;">
                            <div class="container-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                                <h3 style="margin:0; font-size:0.9rem;"><i class="ph ph-broadcast" style="color:var(--accent);"></i> LIVE SIGNAL STREAM</h3>
                                <a href="#orders" class="dim-label" style="font-size:0.7rem; text-decoration:none;">VIEW TERMINAL <i class="ph ph-arrow-right"></i></a>
                            </div>
                        <div class="activity-log-dense" style="max-height: 400px; overflow-y: auto;">
                            ${(dashboardData.recentOrders || []).map(order => `
                                <div class="log-item" style="padding:12px 20px; border-bottom:1px solid rgba(255,255,255,0.03); display:flex; align-items:center; gap:12px;">
                                    <div class="status-indicator ${order.status}" style="width:8px; height:8px; border-radius:50%; background:${order.status === 'delivered' ? 'var(--accent)' : 'var(--warning)'};"></div>
                                    <div style="flex:1;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                            <span style="font-weight:700; font-size:0.85rem;">${order.customerName}</span>
                                            <span style="font-family:'JetBrains Mono'; font-size:0.75rem; color:var(--accent);">৳${(order.amount || 0).toLocaleString()}</span>
                                        </div>
                                        <div style="font-size:0.75rem; color:var(--text-dim);">${order.items?.[0]?.title || 'Digital Asset'} • ${getTimeAgo(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt))}</div>
                                    </div>
                                    <button class="icon-btn" style="color:var(--text-dim);"><i class="ph ph-magnifying-glass"></i></button>
                                </div>
                            `).join('') || '<div style="padding:40px; text-align:center; color:var(--text-dim);">No active signals.</div>'}
                        </div>
                    </div>

                    <!-- Client Highlights -->
                    <div class="widget-container premium-card" style="padding:0;">
                        <div class="container-header" style="padding:16px 20px; border-bottom:1px solid var(--border);">
                            <h3 style="margin:0; font-size:0.9rem;"><i class="ph ph-users-three" style="color:var(--accent);"></i> COUNTERPARTY HUB</h3>
                        </div>
                        <div style="padding:20px;">
                            <div class="mini-stats-stack" style="margin-bottom:24px;">
                                <div class="stat-item" style="display:flex; justify-content:space-between; margin-bottom:12px;">
                                    <div class="label" style="color:var(--text-dim); font-size:0.75rem;">ONBOARDED CUSTOMERS</div>
                                    <div class="val" style="font-weight:800; color:var(--accent);">${dashboardData.totalCustomers || 0}</div>
                                </div>
                                <div class="stat-item" style="display:flex; justify-content:space-between;">
                                    <div class="label" style="color:var(--text-dim); font-size:0.75rem;">SATISFACTION INDEX</div>
                                    <div class="val" style="font-weight:800; color:var(--accent);">98.4%</div>
                                </div>
                            </div>
                            
                            <div class="customer-preview-list">
                                <p style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase; margin-bottom:12px; font-weight:800;">Recently Active</p>
                                ${(dashboardData.topCustomers || []).map(cust => `
                                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                                        <div style="width:32px; height:32px; border-radius:50%; background:var(--bg-deep); display:flex; align-items:center; justify-content:center; border:1px solid var(--border); font-size:0.7rem; font-weight:800; color:var(--accent);">${cust.name?.[0]}</div>
                                        <div style="flex:1;">
                                            <div style="font-size:0.8rem; font-weight:700;">${cust.name}</div>
                                            <div style="font-size:0.65rem; color:var(--text-dim);">${cust.company || 'Private Client'}</div>
                                        </div>
                                        <i class="ph ph-identification-card" style="color:var(--text-dim); cursor:pointer;"></i>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <button class="pill" style="width:100%; margin-top:12px; background:transparent; border:1px solid var(--border); color:var(--text-muted); font-size:0.75rem;">ALL COUNTERPARTIES</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        initDashboardCharts();
    } catch (err) { 
        console.error("[UI] Critical UI Failure:", err); 
        content.innerHTML = `<div style="padding:100px; text-align:center;"><h2 style="color:var(--danger);">LINK FAILURE</h2><p class="dim-label">Operational interface dropped. Reboot recommended.</p><button onclick="location.reload()" class="premium-btn primary" style="margin-top:20px;">SAFE REBOOT</button></div>`;
    }
}

function initDashboardCharts() {
    const common = { 
        type: 'line', 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            animation: { duration: 0 },
            plugins: { legend: { display: false }, tooltip: { enabled: false } }, 
            elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }, 
            scales: { x: { display: false }, y: { display: false } } 
        } 
    };

    const sCtx = document.getElementById('salesSparkline');
    if (sCtx) {
        dashboardCharts.sales = new Chart(sCtx, { 
            ...common, 
            data: { labels: [1,2,3,4,5,6,7,8,9,10], datasets: [{ data: [12, 19, 15, 22, 18, 25, 23, 28, 26, 30], borderColor: '#00C9BC', backgroundColor: 'rgba(0, 201, 188, 0.05)', fill: true }] } 
        });
    }

    const pCtx = document.getElementById('profitSparkline');
    if (pCtx) {
        dashboardCharts.profit = new Chart(pCtx, { 
            ...common, 
            data: { labels: [1,2,3,4,5,6,7,8,9,10], datasets: [{ data: [100, 95, 105, 90, 85, 88, 86, 92, 95, 98], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', fill: true }] } 
        });
    }

    const rCtx = document.getElementById('profitRadar');
    if (rCtx) {
        dashboardCharts.radar = new Chart(rCtx, {
            type: 'radar',
            data: { labels: ['Growth', 'Efficiency', 'Risk', 'Retention', 'Volume'], datasets: [{ data: [85, 72, 90, 65, 88], backgroundColor: 'rgba(0, 201, 188, 0.2)', borderColor: '#00C9BC' }] },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }, 
                scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#94a3b8', font: { size: 9 } }, ticks: { display: false } } } 
            }
        });
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just Now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
}
