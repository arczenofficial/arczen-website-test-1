/**
 * ArcZen Financial Intelligence Engine
 * Handles multi-currency conversions and professional cost/profit formulas.
 */

export class FinanceEngine {
    constructor() {
        this.updateState();
        this.syncFx();
    }

    /**
     * Fetch Live FX rates from open sources
     */
    async syncFx() {
        try {
            console.log("[Finance] Syncing FX Rail...");
            const resp = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await resp.json();
            if (data.rates && data.rates.BDT) {
                const newRate = data.rates.BDT;
                console.log(`[Finance] Live Rate Locked: 1 USD = ${newRate} BDT`);
                window.CuteState.fxRate = newRate;
                this.updateState();
                
                // Trigger UI update if we're on a page that shows FX
                const t = document.querySelector('.fx-ticker .rate');
                if (t) t.textContent = `৳${newRate.toFixed(2)}`;
            }
        } catch (e) {
            console.warn("[Finance] FX Rail Offline. Using fallback:", this.fxRate);
        }
    }

    /**
     * Refresh internal parameters from global state
     */
    updateState() {
        this.fxRate = window.CuteState?.fxRate || 119.50;
        this.config = window.CuteState?.sourcingConfig || {
            gatewayFee: 0.025,
            marketingCost: 0,
            includeMarketing: true
        };
    }

    /**
     * Convert USD to BDT
     * @param {number} usd 
     */
    toBDT(usd) {
        return usd * this.fxRate;
    }

    /**
     * Convert BDT to USD
     * @param {number} bdt 
     */
    toUSD(bdt) {
        return bdt / this.fxRate;
    }

    /**
     * Calculate Net Profit for a transaction
     * @param {Object} params 
     * @param {number} params.grossUsd - Sale price in USD
     * @param {number} params.costUsd - Sourcing cost in USD
     * @param {boolean} [params.isDigital=true] - If digital, skip shipping
     */
    calculateTransactionNet(params) {
        this.updateState();
        const { grossUsd, costUsd } = params;

        const grossBdt = this.toBDT(grossUsd);
        const costBdt = this.toBDT(costUsd);
        
        const gatewayFee = grossBdt * this.config.gatewayFee;
        const marketing = this.config.includeMarketing ? this.config.marketingCost : 0;
        
        const netProfitBdt = grossBdt - costBdt - gatewayFee - marketing;
        const roi = (netProfitBdt / costBdt) * 100;

        return {
            grossBdt,
            costBdt,
            gatewayFee,
            marketing,
            netProfitBdt,
            roi: isFinite(roi) ? roi : 0
        };
    }

    /**
     * Format currency with consistent locale rules
     */
    format(value, currency = 'BDT') {
        const symbol = currency === 'BDT' ? '৳' : '$';
        return `<sup>${symbol}</sup>${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

export const finance = new FinanceEngine();
