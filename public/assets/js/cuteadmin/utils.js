// ArcZen Admin Utilities & Visual Helpers
export const utils = {
    /**
     * Professional Toast Notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'neutral', 'warning'
     */
    showToast: (message, type = "neutral") => {
        let bg = "#333";
        if (type === "success") bg = "#10b981";
        if (type === "error") bg = "#ef4444";
        if (type === "warning") bg = "#f59e0b";

        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { borderLeft: `4px solid ${bg}`, background: "var(--bg-surface)", color: "var(--text)" },
            stopOnFocus: true
        }).showToast();
    },

    /**
     * Format currency (BDT)
     */
    formatCurrency: (val) => {
        return `৳${Math.round(val).toLocaleString()}`;
    },

    /**
     * Relative time formatter
     */
    getTimeAgo: (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return "Just Now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    },

    /**
     * Generate chart configurations for consistent Bloomberg styling
     */
    getBloombergChartConfig: (labels, data, color = "#00C9BC") => {
        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data,
                    borderColor: color,
                    backgroundColor: `${color}10`,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        };
    },

    /**
     * Android-style Bottom Sheet for Mobile Quick Actions
     */
    renderBottomSheet: (title, options = []) => {
        const existing = document.getElementById('terminalBottomSheet');
        if (existing) existing.remove();

        const sheet = document.createElement('div');
        sheet.id = 'terminalBottomSheet';
        sheet.className = 'bottom-sheet-container';
        sheet.innerHTML = `
            <div class="bottom-sheet-backdrop"></div>
            <div class="bottom-sheet-surface">
                <div class="sheet-handle"></div>
                <div class="sheet-header">
                    <h4>${title}</h4>
                    <button class="close-sheet"><i class="ph ph-x"></i></button>
                </div>
                <div class="sheet-content">
                    ${options.map(opt => `
                        <div class="sheet-option" id="${opt.id}">
                            <i class="ph ${opt.icon}"></i>
                            <div class="option-text">
                                <span class="label">${opt.label}</span>
                                ${opt.desc ? `<span class="desc">${opt.desc}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(sheet);

        // Events
        sheet.querySelector('.bottom-sheet-backdrop').onclick = () => sheet.classList.remove('active');
        sheet.querySelector('.close-sheet').onclick = () => sheet.classList.remove('active');
        
        options.forEach(opt => {
            const el = document.getElementById(opt.id);
            if (el && opt.action) {
                el.onclick = () => {
                    opt.action();
                    sheet.classList.remove('active');
                };
            }
        });

        setTimeout(() => sheet.classList.add('active'), 10);
    }
};

export const showToast = utils.showToast;
