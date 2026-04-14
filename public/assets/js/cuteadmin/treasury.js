/**
 * ArcZen Treasury Terminal
 * Forensic capital management and liquidity tracking.
 */
import { 
    collection, doc, getDocs, addDoc, updateDoc, query, orderBy, serverTimestamp, writeBatch, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast, utils } from './utils.js';

export async function renderTreasuryPage() {
    const mainArea = document.getElementById('mainContentArea');
    if (!mainArea) return;

    mainArea.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;"><i class="ph ph-vault" style="color:var(--accent);"></i> Treasury Management</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Capital Pools & Liquid Asset Distribution</p>
                </div>
                <button id="newAccountBtn" class="premium-btn primary"><i class="ph ph-plus-bold"></i> INITIALIZE_ACCOUNT</button>
            </div>

            <!-- Capital Distribution Strip -->
            <div class="metrics-strip glow" id="treasuryStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <!-- Injected via loadStats -->
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
                <!-- Managed Accounts Grid -->
                <div class="data-terminal">
                    <div class="container-header" style="padding: 16px; border-bottom: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Active Liquidity Pools</h3>
                        <span class="badge-v2">REAL-TIME UPLINK</span>
                    </div>
                    <div id="accountsGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px; padding:20px;">
                        <!-- Injected -->
                    </div>
                </div>

                <!-- Forensic Transaction Log -->
                <div class="data-terminal">
                   <div class="container-header" style="padding: 16px; border-bottom: 1px solid var(--border);">
                        <h3 style="margin:0; font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:1px;"><i class="ph ph-clock-counter-clockwise"></i> Capital Movements</h3>
                    </div>
                    <div id="treasuryLogs" style="padding:12px; font-size:0.8rem;">
                        <!-- Injected -->
                    </div>
                </div>
            </div>
        </div>

        <!-- Account Initialization Modal -->
        <div id="accountModal" class="terminal-modal" style="display:none;">
            <div class="modal-surface" style="max-width: 500px;">
                <div class="modal-header-v2">
                    <h3 id="accModalTitle">Initialize Liquid Pool</h3>
                    <button id="closeAccModal" class="icon-btn"><i class="ph ph-x"></i></button>
                </div>
                <form id="accountForm" class="terminal-form" style="padding:24px;">
                    <input type="hidden" id="accId">
                    <div class="form-grid">
                        <div class="form-section span-3">
                            <label>ACCOUNT IDENTIFIER</label>
                            <input type="text" id="accName" placeholder="e.g. Brac Bank, Office Cash, Bkash Main" required>
                        </div>
                        <div class="form-section span-3">
                            <label>LIQUIDITY TYPE</label>
                            <select id="accType">
                                <option value="bank">BANKING CHANNEL</option>
                                <option value="cash">PHYSICAL VAULT (CASH)</option>
                                <option value="digital">DIGITAL WALLET (BKASH/NAGAD)</option>
                                <option value="investment">INVESTMENT POOL</option>
                            </select>
                        </div>
                        <div class="form-section span-3">
                            <label>OPENING BALANCE (৳)</label>
                            <input type="number" id="accBalance" value="0" step="0.01">
                        </div>
                    </div>
                    <div class="modal-footer-v2" style="margin-top:24px;">
                        <button type="submit" class="premium-btn primary" style="width:100%; justify-content:center;">COMMIT ACCOUNT</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Transfer/Adjustment Modal -->
        <div id="adjustModal" class="terminal-modal" style="display:none;">
            <div class="modal-surface" style="max-width: 450px;">
                <div class="modal-header-v2">
                    <h3>Capital Adjustment</h3>
                    <button onclick="document.getElementById('adjustModal').style.display='none'" class="icon-btn"><i class="ph ph-x"></i></button>
                </div>
                <form id="adjustForm" class="terminal-form" style="padding:24px;">
                    <input type="hidden" id="adjAccId">
                    <div class="form-grid">
                        <div class="form-section span-3">
                            <label>ADJUSTMENT TYPE</label>
                            <select id="adjType">
                                <option value="add">INJECTION (DEPOSIT)</option>
                                <option value="remove">WITHDRAWAL (EXPENSE)</option>
                            </select>
                        </div>
                        <div class="form-section span-3">
                            <label>VOLUME (৳)</label>
                            <input type="number" id="adjAmount" placeholder="0.00" required>
                        </div>
                        <div class="form-section span-3">
                            <label>RATIONALE / METADATA</label>
                            <textarea id="adjNote" placeholder="Explain the capital movement..." required></textarea>
                        </div>
                    </div>
                    <div class="modal-footer-v2" style="margin-top:24px;">
                        <button type="submit" class="premium-btn primary" style="width:100%; justify-content:center;">SYNC TREASURY</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupTreasuryUI();
    loadTreasuryData();
}

async function loadTreasuryData() {
    try {
        const accSnap = await getDocs(collection(db, 'treasury'));
        const accounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const logSnap = await getDocs(query(collection(db, 'treasury_logs'), orderBy('timestamp', 'desc'), limit(30)));
        const logs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        renderStats(accounts);
        renderAccounts(accounts);
        renderLogs(logs);
    } catch (e) { console.error("Treasury Sync Error:", e); }
}

function renderStats(accounts) {
    const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const container = document.getElementById('treasuryStats');
    
    container.innerHTML = `
        <div class="mini-card highlight">
            <span class="label">AGGREGATED LIQUIDITY</span>
            <div class="val">৳${total.toLocaleString()}</div>
            <div class="sub-val">${accounts.length} Active Channels</div>
        </div>
        <div class="mini-card highlight-accent">
            <span class="label">DIGITAL LIQUIDITY</span>
            <div class="val accent">৳${accounts.filter(a => a.type === 'digital').reduce((s, a) => s + a.balance, 0).toLocaleString()}</div>
            <div class="sub-val">Wallets & Gateways</div>
        </div>
        <div class="mini-card">
            <span class="label">PHYSICAL RESERVE</span>
            <div class="val">৳${accounts.filter(a => a.type === 'cash').reduce((s, a) => s + a.balance, 0).toLocaleString()}</div>
            <div class="sub-val">On-site Vaults</div>
        </div>
    `;
}

function renderAccounts(accounts) {
    const grid = document.getElementById('accountsGrid');
    grid.innerHTML = accounts.map(a => `
        <div class="premium-card account-card" style="border:1px solid var(--border); padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div class="badge-v2" style="background:var(--accent-soft); color:var(--accent); font-size:0.6rem;">${a.type.toUpperCase()}</div>
                <div style="display:flex; gap:6px;">
                    <button class="icon-btn-v2" onclick="window.openAdjustModal('${a.id}')"><i class="ph ph-arrows-left-right"></i></button>
                    <button class="icon-btn-v2" onclick="window.openEditAcc('${a.id}')"><i class="ph ph-pencil"></i></button>
                </div>
            </div>
            <div style="font-weight:800; font-size:1rem; margin-bottom:4px; color:var(--text-main);">${a.name}</div>
            <div class="val tabular" style="font-size:1.4rem; color:var(--accent);">৳${a.balance.toLocaleString()}</div>
            <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:0.7rem; color:var(--text-dim);">
                <span>LAST_SYNC: ${a.updatedAt?.toDate().toLocaleTimeString() || 'NEW'}</span>
                <span class="signal-pulse"></span>
            </div>
        </div>
    `).join('') || '<div class="dim-label" style="grid-column: 1/-1; text-align:center; padding:40px;">No liquidity pools initialized.</div>';
}

function renderLogs(logs) {
    const list = document.getElementById('treasuryLogs');
    list.innerHTML = logs.map(l => `
        <div style="padding:10px; border-bottom:1px solid var(--border); margin-bottom:4px; background:rgba(0,0,0,0.1); border-radius:6px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span class="semi-bold" style="color:${l.type === 'add' ? 'var(--success)' : 'var(--danger)'};">
                    ${l.type === 'add' ? '+' : '-'} ৳${l.amount.toLocaleString()}
                </span>
                <span class="tabular dim-label" style="font-size:0.65rem;">${l.timestamp?.toDate().toLocaleString() || 'NOW'}</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-main);">${l.note}</div>
            <div class="dim-label" style="font-size:0.6rem; margin-top:4px; display:flex; gap:10px;">
                <span>OP: ${l.by}</span>
                <span>SRC: ${l.accountName}</span>
                <span style="margin-left:auto;">${l.ip || '0.0.0.0'}</span>
            </div>
        </div>
    `).join('') || '<div class="dim-label text-center">No transactions recorded.</div>';
}

function setupTreasuryUI() {
    document.getElementById('newAccountBtn').onclick = () => {
        document.getElementById('accountForm').reset();
        document.getElementById('accId').value = '';
        document.getElementById('accModalTitle').textContent = 'Initialize Liquid Pool';
        document.getElementById('accountModal').style.display = 'flex';
    };

    document.getElementById('closeAccModal').onclick = () => document.getElementById('accountModal').style.display = 'none';

    document.getElementById('accountForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('accId').value;
        const data = {
            name: document.getElementById('accName').value,
            type: document.getElementById('accType').value,
            balance: parseFloat(document.getElementById('accBalance').value) || 0,
            updatedAt: serverTimestamp()
        };

        try {
            if (id) await updateDoc(doc(db, 'treasury', id), data);
            else await addDoc(collection(db, 'treasury'), data);
            
            showToast('Treasury Pulse Updated', 'success');
            document.getElementById('accountModal').style.display = 'none';
            loadTreasuryData();
        } catch (e) { showToast('Uplink Interrupted', 'error'); }
    };

    window.openAdjustModal = (id) => {
        document.getElementById('adjAccId').value = id;
        document.getElementById('adjustForm').reset();
        document.getElementById('adjustModal').style.display = 'flex';
    };

    document.getElementById('adjustForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('adjAccId').value;
        const type = document.getElementById('adjType').value;
        const amount = parseFloat(document.getElementById('adjAmount').value) || 0;
        const note = document.getElementById('adjNote').value;

        try {
            const accSnap = await getDocs(query(collection(db, 'treasury')));
            const acc = accSnap.docs.find(d => d.id === id);
            if (!acc) throw new Error("Account Void");

            const newBalance = type === 'add' ? acc.data().balance + amount : acc.data().balance - amount;
            
            const batch = writeBatch(db);
            batch.update(doc(db, 'treasury', id), { balance: newBalance, updatedAt: serverTimestamp() });
            
            batch.add(collection(db, 'treasury_logs'), {
                accountId: id,
                accountName: acc.data().name,
                amount,
                type,
                note,
                timestamp: serverTimestamp(),
                by: window.CuteState.user.email,
                ip: 'CLIENT_PULSE', // Simulator for IP
                browser: navigator.userAgent
            });

            await batch.commit();
            showToast('Capital Adjustment Synchronized', 'success');
            document.getElementById('adjustModal').style.display = 'none';
            loadTreasuryData();
        } catch (e) { showToast('Forensic Failure', 'error'); }
    }
}
