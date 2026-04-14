// Company Settings Module - Configurable Company Profile for Invoices
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';
const SETTINGS_DOC = "settings/company";

// Default company settings
const DEFAULT_SETTINGS = {
    name: "ArcZen Digital",
    tagline: "Luxury Digital Assets & Global Sourcing",
    email: "ops@arczen.store",
    phone: "+880 1XXX-XXXXXX",
    address: "Strategic Command, Bangladesh",
    website: "www.arczen.store",
    logoUrl: "/assets/images/logo-placeholder.svg",
    taxId: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankBranch: "",
    defaultTerms: "System settlements are final. Access codes delivered post-confirmation.",
    defaultCurrency: "BDT",
    currencySymbol: "৳",
    maintenanceMode: false
};

// Cached settings
let cachedSettings = null;

/**
 * Get company settings (with caching)
 */
export async function getCompanySettings(forceRefresh = false) {
    if (cachedSettings && !forceRefresh) return { ...cachedSettings };
    try {
        const docRef = doc(db, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            cachedSettings = { ...DEFAULT_SETTINGS, ...docSnap.data() };
        } else {
            cachedSettings = { ...DEFAULT_SETTINGS };
            await setDoc(docRef, { ...DEFAULT_SETTINGS, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        return { ...cachedSettings };
    } catch (error) {
        console.error("Error fetching company settings:", error);
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Update company settings (Admin only)
 */
export async function updateCompanySettings(updates) {
    try {
        if (!['super_admin', 'founder'].includes(window.CuteState?.role)) {
            showToast("Unauthorized: Security Clearance Required", "error");
            return false;
        }
        const docRef = doc(db, SETTINGS_DOC);
        await setDoc(docRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
        cachedSettings = null;
        showToast("System Configuration Updated", "success");
        return true;
    } catch (error) {
        console.error("Error updating settings:", error);
        showToast("Update Failure", "error");
        return false;
    }
}

/**
 * Render Company Settings Page (Admin only)
 */
export async function renderCompanySettingsPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    if (!['super_admin', 'founder'].includes(window.CuteState?.role)) {
        content.innerHTML = `<div class="module-container"><div class="premium-card text-center" style="padding:100px;"><h3>ACCESS RESTRICTED</h3><p class="dim-label">Contact High Command for System Configuration clearance.</p></div></div>`;
        return;
    }

    const settings = await getCompanySettings(true);

    content.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">System Configuration</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Global Parameters, Identity & Settlement Protocols</p>
                </div>
            </div>
            
            <form id="companySettingsForm" class="terminal-form">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <!-- Core Identity -->
                    <div class="premium-card">
                        <div class="card-header-v2"><h3><i class="ph ph-fingerprint"></i> CORE IDENTITY</h3></div>
                        <div style="padding:20px;">
                            <div class="input-group-v2">
                                <label>TRADING NAME</label>
                                <input type="text" id="companyName" value="${settings.name}" class="terminal-input" required>
                            </div>
                            <div class="input-group-v2" style="margin-top:16px;">
                                <label>TAGLINE / SLOGAN</label>
                                <input type="text" id="companyTagline" value="${settings.tagline || ''}" class="terminal-input">
                            </div>
                            <div class="input-group-v2" style="margin-top:16px;">
                                <label>LOGO RESOURCE URL</label>
                                <input type="text" id="companyLogo" value="${settings.logoUrl || ''}" class="terminal-input">
                            </div>
                        </div>
                    </div>

                    <!-- Operational Toggles -->
                    <div class="premium-card">
                        <div class="card-header-v2"><h3><i class="ph ph-toggle-left"></i> OPERATIONAL STATUS</h3></div>
                        <div style="padding:20px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-deep); border-radius:12px; border:1px solid var(--border);">
                                <div>
                                    <div style="font-weight:700; font-size:0.85rem;">MAINTENANCE_MODE</div>
                                    <div style="font-size:0.7rem; color:var(--text-dim);">Lock public store for maintenance</div>
                                </div>
                                <input type="checkbox" id="maintenanceMode" ${settings.maintenanceMode ? 'checked' : ''} style="width:20px; height:20px; accent-color:var(--accent);">
                            </div>
                            
                            <div class="input-group-v2" style="margin-top:24px;">
                                <label>GLOBAL SETTLEMENT CURRENCY</label>
                                <select id="defaultCurrency" class="terminal-input">
                                    <option value="BDT" ${settings.defaultCurrency === 'BDT' ? 'selected' : ''}>৳ BDT (Taka)</option>
                                    <option value="USD" ${settings.defaultCurrency === 'USD' ? 'selected' : ''}>$ USD (Dollar)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Financial Parameters -->
                <div class="premium-card" style="margin-top:24px;">
                    <div class="card-header-v2"><h3><i class="ph ph-currency-circle-dollar"></i> FINANCIAL PARAMS & GATEWAY FEES</h3></div>
                    <div style="padding:20px; display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">
                        <div class="input-group-v2">
                            <label>FX BASE (USD/BDT)</label>
                            <input type="number" id="bdtUsdRate" value="${settings.bdtUsdRate || 120}" class="terminal-input" step="0.01">
                        </div>
                        <div class="input-group-v2">
                            <label>INTL FEE (%)</label>
                            <input type="number" id="usdPaymentFee" value="${settings.usdPaymentFee || 0}" class="terminal-input" step="0.1">
                        </div>
                        <div class="input-group-v2">
                            <label>MOBILE FEE (%)</label>
                            <input type="number" id="bkashFee" value="${settings.bkashFee || 1.85}" class="terminal-input" step="0.1">
                        </div>
                    </div>
                </div>

                <div class="form-actions" style="margin-top:32px; display:flex; justify-content:flex-end;">
                    <button type="submit" class="premium-btn primary" style="padding: 12px 32px; font-weight:800;">
                        <i class="ph ph-floppy-disk"></i> COMMIT CHANGES
                    </button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('companySettingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            name: document.getElementById('companyName').value.trim(),
            tagline: document.getElementById('companyTagline').value.trim(),
            logoUrl: document.getElementById('companyLogo').value.trim(),
            maintenanceMode: document.getElementById('maintenanceMode').checked,
            defaultCurrency: document.getElementById('defaultCurrency').value,
            bdtUsdRate: parseFloat(document.getElementById('bdtUsdRate').value) || 120,
            usdPaymentFee: parseFloat(document.getElementById('usdPaymentFee').value) || 0,
            bkashFee: parseFloat(document.getElementById('bkashFee').value) || 0,
        };
        await updateCompanySettings(updates);
    });
}
