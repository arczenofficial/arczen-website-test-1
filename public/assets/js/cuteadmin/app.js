import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { query, collection, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from './db.js';
import { login, logout } from './auth.js';
import { renderLoginPage, renderDashboardPage, renderDashboardContent } from './ui.js';
import { showToast } from './utils.js';
import { renderProductsPage } from './products-admin.js';
import { finance } from './finance-engine.js';
import { Seeder } from './seeder.js';

// ── Permission gate check ─────────────────────────────────────────────────
// Returns true if the currently logged-in user has access to a named section.
// Founders and super_admins bypass the check entirely.
function canAccess(section) {
    const role = window.CuteState.role;
    if (role === 'founder' || role === 'super_admin') return true;
    const perms = window.CuteState.userProfile?.permissions;
    return perms && perms[section] === true;
}

function denyAccess(section) {
    const el = document.getElementById('mainContentArea');
    if (!el) return;
    el.innerHTML = `
        <div style="padding:100px; text-align:center;">
            <i class="ph ph-lock-simple" style="font-size:4rem; color:var(--danger);"></i>
            <h2 style="margin-top:24px; color:var(--danger);">RESTRICTED</h2>
            <p class="dim-label">You do not have permission to view the <strong>${section}</strong> section.</p>
            <p style="font-size:0.8rem; color:var(--text-dim); margin-top:8px;">Contact your founder to request access.</p>
        </div>`;
}


// --- Core Routing Router ---
const handleRoute = async () => {
    const hash = window.location.hash || '#dashboard';
    console.log(`[Router] Segment Switch: ${hash}`);
    
    // Auth Guard
    if (hash === '#login') {
        if (window.CuteState.user) { window.location.hash = '#dashboard'; return; }
        renderLoginPage();
        setupLoginEvents();
        return;
    }
    if (!window.CuteState.user) return;

    // Shell Integrity Check
    const shell = document.querySelector('.admin-shell');
    if (!shell) {
        document.getElementById('app').innerHTML = `
            <div class="admin-shell">
                <aside class="sidebar-v2" id="mainSidebar"></aside>
                <div class="main-wrapper">
                    <header class="topbar-v2" id="mainTopbar"></header>
                    <main class="content-area-v2" id="mainContentArea"></main>
                    <nav class="mobile-nav-v2" id="mobileBottomNav"></nav>
                </div>
            </div>`;
    }

    // Refresh Navigation & Shell Data
    renderDashboardPage(window.CuteState.user);
    updateActiveNavLink(hash);

    // Module Loading Logic
    try {
        switch(hash) {
            case '#dashboard': case '': 
                renderDashboardContent(); 
                break;
            case '#products':
                if (!canAccess('products')) { denyAccess('Products'); break; }
                renderProductsPage(); 
                break;
            case '#orders':
                if (!canAccess('orders')) { denyAccess('Orders'); break; }
                const { renderOrdersPage } = await import('./orders-admin.js');
                renderOrdersPage();
                break;
            case '#finance':
                if (!canAccess('finance')) { denyAccess('Finance'); break; }
                const { renderFinancePage } = await import('./finance.js');
                renderFinancePage();
                break;
            case '#ultimate': 
                const { renderEquityPage } = await import('./equity.js');
                renderEquityPage();
                break;
            case '#attendance':
                if (!canAccess('attendance')) { denyAccess('Attendance'); break; }
                const { renderAttendancePage } = await import('./attendance-ui.js');
                renderAttendancePage();
                break;
            case '#analytics':
                if (!canAccess('analytics')) { denyAccess('Analytics'); break; }
                const { renderAnalyticsPage } = await import('./analytics.js');
                renderAnalyticsPage();
                break;
            case '#logs':
                if (!canAccess('logs')) { denyAccess('Logs'); break; }
                const { renderTeamLogsPage } = await import('./team-logs.js');
                renderTeamLogsPage();
                break;
            case '#system-settings':
                if (!canAccess('system-settings')) { denyAccess('System Settings'); break; }
                const { renderCompanySettingsPage } = await import('./company-settings.js');
                renderCompanySettingsPage();
                break;
            case '#points':
                if (!canAccess('points')) { denyAccess('Points'); break; }
                const { renderPointsPage } = await import('./points-ui.js');
                renderPointsPage();
                break;
            case '#treasury':
                if (!canAccess('finance')) { denyAccess('Treasury'); break; }
                const { renderTreasuryPage } = await import('./treasury.js');
                renderTreasuryPage();
                break;
            case '#inventory':
                if (!canAccess('inventory')) { denyAccess('Inventory'); break; }
                const { renderInventoryPage } = await import('./inventory-mgr.js');
                renderInventoryPage();
                break;

            // ── NEW ROUTES ──────────────────────────────────────────────────
            case '#users':
                // Team management — founders and super_admins only
                const { renderUserManagementUI } = await import('./user-management.js');
                renderUserManagementUI();
                break;
            case '#store-customers':
                // Store customer analytics — founders only
                if (!canAccess('customers')) { denyAccess('Customer Analytics'); break; }
                const { renderStoreCustomersPage } = await import('./store-customers.js');
                renderStoreCustomersPage();
                break;

            default:
                document.getElementById('mainContentArea').innerHTML = `
                    <div style="padding:100px; text-align:center;">
                        <i class="ph ph-terminal-window" style="font-size:4rem; color:var(--text-dim);"></i>
                        <h2 style="margin-top:24px;">MODULE NOT LINKED</h2>
                        <p class="dim-label">Segment "${hash}" is currently offline or under maintenance.</p>
                    </div>`;
        }
    } catch (err) {
        console.error("Routing Error:", err);
        showToast("Terminal Switching Error", "error");
    }
};

function updateActiveNavLink(hash) {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === hash);
    });
}

function setupLoginEvents() {
    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
        const { loginWithGoogle } = await import('./auth.js');
        await loginWithGoogle(auth);
    });
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        await login(auth, email, password);
    });
}

// --- Lifecycle & System Observers ---
onAuthStateChanged(auth, async (user) => {
    window.CuteState.user = user;
    if (user) {
        console.log(`[Auth] User detected: ${user.email}`);
        try {
            console.log("[Auth] Synchronizing Profile...");
            const { syncUserProfile } = await import('./users.js');
            const userProfile = await syncUserProfile(user);
            console.log("[Auth] Profile Active. Role:", userProfile.role);

            window.CuteState.role = userProfile.role || 'employee';
            window.CuteState.userProfile = userProfile;
            window.CuteState.viewMode = window.CuteState.role;
            
            // Security Gate
            if (!userProfile.beautiful) {
                console.warn("[Auth] Security Gate Triggered: beautiful=false");
                renderLockScreen(user.email);
                return;
            }

            console.log("[Auth] Security Clearance Granted. Launching Terminal...");
            handleRoute();
            setupBadgeObservers();
        } catch (e) { 
            console.error("[Auth] Fatal Lifecycle Error:", e);
            showToast("System Initialization Error", "error");
        }
    } else {
        console.log("[Auth] No session detected. Reverting to login.");
        window.location.hash = '#login';
    }
});

function renderLockScreen(email) {
    document.getElementById('app').innerHTML = `
        <div style="height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg-deep);">
            <div class="premium-card" style="max-width:400px; text-align:center; padding:40px;">
                <i class="ph ph-lock-keyhole" style="font-size:4rem; color:var(--accent);"></i>
                <h2 style="margin-top:24px;">VAULT LOCKED</h2>
                <p class="dim-label" style="font-size:0.85rem; margin:16px 0;">"Beautiful" safety protocol is active for <strong>${email}</strong>. Contact High Command for clearance.</p>
                <button onclick="location.reload()" class="pill" style="background:var(--accent); color:var(--bg-deep); width:100%;">RETRY AUTHENTICATION</button>
            </div>
        </div>`;
}

function setupBadgeObservers() {
    const isAdmin = ['super_admin', 'founder', 'finance_admin', 'moderator'].includes(window.CuteState.role);
    if (!isAdmin) return;

    console.log("[Observer] Initializing Live Badge Uplink...");
    const q = query(collection(db, "orders"), where("status", "==", "pending"));
    
    onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        const badge = document.getElementById('orderBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
            if (count > 0) {
                badge.classList.add('glowing');
            } else {
                badge.classList.remove('glowing');
            }
        }
    }, (err) => console.error("[Observer] Badge Failure:", err));
}

window.addEventListener('hashchange', handleRoute);
document.addEventListener('app:logout', () => logout(auth));

console.log("ArcZen Command OS v2.0 Inline");
