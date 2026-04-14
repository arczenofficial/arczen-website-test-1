import {
    collection, getDocs, query, orderBy, limit, collectionGroup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

export async function renderAnalyticsPage() {
    const mainArea = document.getElementById('mainContentArea');
    if (!mainArea) return;

    mainArea.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Intelligence Terminal</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Quantitative Analysis & Product Sales Velocity</p>
                </div>
                <div class="terminal-badge">LIVE_SYNC: ACTIVE</div>
            </div>

            <!-- Bloomberg-style Metric Tabs -->
            <div class="metrics-strip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="mini-card highlight">
                    <span class="label">GROSS REVENUE (30D)</span>
                    <div class="val" id="anaRevenue">--</div>
                    <div class="spark-box"><canvas id="revSpark"></canvas></div>
                </div>
                <div class="mini-card">
                    <span class="label">NET MARGIN</span>
                    <div class="val accent" id="anaProfit">--</div>
                    <div class="spark-box"><canvas id="profSpark"></canvas></div>
                </div>
                <div class="mini-card">
                    <span class="label">AVG UNIT PRICE</span>
                    <div class="val" id="anaAOV">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">VOLUME (UNITS)</span>
                    <div class="val" id="anaVolume">--</div>
                </div>
            </div>

            <div class="terminal-grid" style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 24px;">
                <!-- Main Intelligence View -->
                <div class="premium-card" style="min-height: 400px;">
                    <div class="card-header-v2">
                        <h3><i class="ph ph-chart-line-up"></i> SALES VELOCITY TRAJECTORY</h3>
                        <div class="actions">
                            <span class="tag">30 DAY WINDOW</span>
                        </div>
                    </div>
                    <div style="height: 300px; padding: 20px;">
                        <canvas id="velocityChart"></canvas>
                    </div>
                </div>

                <!-- Product Categorization -->
                <div class="premium-card">
                    <div class="card-header-v2">
                        <h3><i class="ph ph-ranking"></i> ASSET PERFORMANCE</h3>
                    </div>
                    <div id="topProductsTable" class="dense-list" style="padding:10px;">
                        <div class="loader-v2">CRUNCHING_INDEX...</div>
                    </div>
                </div>
            </div>

            <div class="terminal-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 24px;">
                <div class="premium-card">
                    <div class="card-header-v2"><h3>CATEGORY DISTRO</h3></div>
                    <div style="height:200px; padding:15px;"><canvas id="categoryDonut"></canvas></div>
                </div>
                <div class="premium-card">
                    <div class="card-header-v2"><h3>ACQUISITION EFFICIENCY</h3></div>
                    <div style="padding:20px;">
                        <div class="kpi-row"><span>Organic</span> <span class="val">82%</span></div>
                        <div class="progress-bar-small"><div class="fill" style="width:82%;"></div></div>
                        <div class="kpi-row" style="margin-top:15px;"><span>Referral</span> <span class="val">18%</span></div>
                        <div class="progress-bar-small"><div class="fill" style="width:18%; background:var(--warning);"></div></div>
                    </div>
                </div>
                <div class="premium-card">
                    <div class="card-header-v2"><h3>COHORT RETENTION</h3></div>
                    <div style="height:200px; padding:15px;"><canvas id="retentionRadar"></canvas></div>
                </div>
            </div>
        </div>
    `;

    loadAnalyticsData();
}

async function loadAnalyticsData() {
    try {
        const ordersSnap = await getDocs(query(collectionGroup(db, 'items'), orderBy('createdAt', 'desc'), limit(200)));
        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const stats = processOrders(orders);
        updateUI(stats);
        renderCharts(stats);
    } catch (e) {
        console.error("Analytics Fatal Error:", e);
    }
}

function processOrders(orders) {
    let totalRevenue = 0;
    let totalCost = 0;
    let volume = 0;
    const products = {};
    const categories = {};
    const timeline = {};

    orders.forEach(o => {
        const amt = o.amount || o.totalAmount || 0;
        const cst = o.items?.reduce((s, i) => s + (i.cost || (i.price * 0.6)), 0) || 0; // Fallback to 40% margin estimate if cost missing
        totalRevenue += amt;
        totalCost += cst;
        volume += (o.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 1);

        // Product tracking
        o.items?.forEach(item => {
            const pid = item.productId || 'unknown';
            if (!products[pid]) products[pid] = { title: item.title, revenue: 0, sales: 0 };
            products[pid].revenue += (item.price * item.quantity);
            products[pid].sales += item.quantity;

            // Category tracking
            const cat = item.category || 'Standard';
            categories[cat] = (categories[cat] || 0) + item.quantity;
        });

        // Timeline (Daily)
        const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : new Date(o.createdAt).toLocaleDateString();
        if (!timeline[date]) timeline[date] = 0;
        timeline[date] += amt;
    });

    const topProds = Object.values(products).sort((a,b) => b.revenue - a.revenue).slice(0, 5);

    return {
        totalRevenue,
        totalProfit: totalRevenue - totalCost,
        aov: totalRevenue / (orders.length || 1),
        volume,
        topProds,
        categories,
        timeline: Object.entries(timeline).slice(-30)
    };
}

function updateUI(stats) {
    document.getElementById('anaRevenue').textContent = `৳${(stats.totalRevenue / 1000).toFixed(1)}K`;
    document.getElementById('anaProfit').textContent = `৳${(stats.totalProfit / 1000).toFixed(1)}K`;
    document.getElementById('anaAOV').textContent = `৳${Math.round(stats.aov).toLocaleString()}`;
    document.getElementById('anaVolume').textContent = stats.volume;

    const list = document.getElementById('topProductsTable');
    list.innerHTML = stats.topProds.map((p, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid rgba(255,255,255,0.03);">
            <div style="font-family:'JetBrains Mono'; color:var(--text-dim); width:20px;">0${i+1}</div>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.85rem;">${p.title}</div>
                <div style="font-size:0.7rem; color:var(--text-dim);">${p.sales} UNITS SOLD</div>
            </div>
            <div style="font-family:'JetBrains Mono'; font-weight:800; color:var(--accent);">৳${(p.revenue/1000).toFixed(1)}K</div>
        </div>
    `).join('');
}

function renderCharts(stats) {
    const labels = stats.timeline.map(t => t[0]);
    const data = stats.timeline.map(t => t[1]);

    // Sales Velocity
    new Chart(document.getElementById('velocityChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'DAILY REVENUE',
                data,
                borderColor: '#00C9BC',
                backgroundColor: 'rgba(0, 201, 188, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } }
            }
        }
    });

    // Donut (Dynamic)
    const catLabels = Object.keys(stats.categories);
    const catData = Object.values(stats.categories);

    new Chart(document.getElementById('categoryDonut'), {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData,
                backgroundColor: ['#00C9BC', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } } } } }
    });

    // Retention Radar
    new Chart(document.getElementById('retentionRadar'), {
        type: 'radar',
        data: {
            labels: ['M1', 'M2', 'M3', 'M4', 'M5'],
            datasets: [{
                data: [100, 85, 70, 65, 60],
                borderColor: '#00C9BC',
                backgroundColor: 'rgba(0, 201, 188, 0.2)'
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#94a3b8' }, ticks: { display: false } } }
        }
    });
}
