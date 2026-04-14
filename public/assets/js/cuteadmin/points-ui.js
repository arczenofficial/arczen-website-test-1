// Points UI - V3 Bloomberg Design Terminal
import {
    getPointsConfig,
    savePointsConfig,
    getLeaderboard,
    getUserTransactions,
    getAllTransactions,
    getLevelColor,
    getNextLevelInfo,
    manualPointAdjust
} from './points.js';
import { showToast, utils } from './utils.js';

export async function renderPointsPage() {
    const mainArea = document.getElementById('mainContentArea');
    if (!mainArea) return;

    const role = window.CuteState?.role || 'employee';

    mainArea.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Medal Terminal</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Personnel Gamification & Meritocracy Index</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${role === 'super_admin' || role === 'founder' ? `
                        <button id="configPointsBtn" class="premium-btn"><i class="ph ph-gear"></i> G_RULES</button>
                    ` : ''}
                </div>
            </div>

            <div id="pointsLoader" class="terminal-loader"><div class="scanner"></div><span>Calculating Social Credit...</span></div>
            <div id="pointsContent" style="display:none;"></div>
        </div>
    `;

    loadPointsTerminal();
}

async function loadPointsTerminal() {
    const container = document.getElementById('pointsContent');
    const loader = document.getElementById('pointsLoader');
    if (!container) return;

    try {
        const leaderboard = await getLeaderboard();
        const top3 = leaderboard.slice(0, 3);
        const others = leaderboard.slice(3);

        container.style.display = 'block';
        loader.style.display = 'none';

        container.innerHTML = `
            <!-- Merit Strips -->
            <div class="metrics-strip grow" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
                ${top3.map((u, i) => {
                    const level = u.level || 'Bronze';
                    const colors = getLevelColor(level);
                    return `
                        <div class="mini-card ${i === 0 ? 'highlight-accent' : ''}" style="position:relative; overflow:hidden;">
                            <span class="label">RANK_0${i+1} ${level.toUpperCase()}</span>
                            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
                                <img src="${u.userPhoto || 'https://ui-avatars.com/api/?name='+u.userName}" style="width:40px; height:40px; border-radius:50%; border:2px solid var(--border);">
                                <div>
                                    <div class="val" style="font-size:1.5rem;">${(u.totalPoints || 0).toLocaleString()}</div>
                                    <div style="font-size:0.75rem; font-weight:700;">${u.userName}</div>
                                </div>
                            </div>
                            <div style="position:absolute; right:-10px; bottom:-10px; font-size:4rem; opacity:0.05; color:var(--text-dim);">${colors.icon}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="terminal-grid" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
                <!-- Main Leaderboard -->
                <div class="premium-card" style="padding:0;">
                    <div class="card-header-v2" style="padding:16px 20px; border-bottom:1px solid var(--border);">
                        <h3><i class="ph ph-medal"></i> GLOBAL STANDINGS</h3>
                    </div>
                    <table class="bloomberg-table">
                        <thead>
                            <tr>
                                <th width="60">RANK</th>
                                <th>IDENTITY</th>
                                <th class="text-center">TIER</th>
                                <th class="text-right">TOTAL_CREDITS</th>
                                <th width="40"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leaderboard.map((u, i) => `
                                <tr>
                                    <td class="tabular dim-label">#${String(i+1).padStart(2, '0')}</td>
                                    <td>
                                        <div style="display:flex; align-items:center; gap:12px;">
                                            <img src="${u.userPhoto || 'https://ui-avatars.com/api/?name='+u.userName}" style="width:24px; height:24px; border-radius:50%;">
                                            <span style="font-weight:700; font-size:0.85rem;">${u.userName}</span>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge-v2" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">${u.level?.toUpperCase() || 'BRONZE'}</span>
                                    </td>
                                    <td class="text-right tabular semi-bold" style="color:var(--accent);">+${(u.totalPoints || 0).toLocaleString()}</td>
                                    <td class="text-right"><i class="ph ph-caret-right dim-label"></i></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Live Merit Stream -->
                <div class="sidebar-v2-container">
                    <div class="premium-card">
                        <div class="card-header-v2"><h3><i class="ph ph-broadcast"></i> MERIT STREAM</h3></div>
                        <div id="meritFeed" style="padding:20px;">
                            <!-- Injected -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        loadMeritStream();

    } catch (e) {
        console.error("Points Terminal Fatal Error:", e);
    }
}

async function loadMeritStream() {
    const feed = document.getElementById('meritFeed');
    if (!feed) return;

    try {
        const txs = await getAllTransactions(10);
        feed.innerHTML = txs.map(t => `
            <div style="display:flex; gap:12px; margin-bottom:16px; font-size:0.75rem;">
                <div style="width:2px; background:${t.points > 0 ? 'var(--success)' : 'var(--danger)'};"></div>
                <div>
                    <div style="font-weight:800; color:var(--text-main);">${t.description}</div>
                    <div style="color:var(--text-dim); margin-top:2px;">${new Date(t.timestamp?.toDate ? t.timestamp.toDate() : t.timestamp).toLocaleTimeString()} — SEC_CLEARANCE: LVL_1</div>
                </div>
            </div>
        `).join('') || '<div class="dim-label">Meritocracy buffer empty. Standing by.</div>';
    } catch (e) {
        feed.innerHTML = '<div class="text-danger">Sync Failure</div>';
    }
}
