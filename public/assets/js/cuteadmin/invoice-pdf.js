// Invoice PDF Generation Module
import { getInvoice, logInvoiceExport } from './invoices.js';
import { getCustomer } from './customers.js';
import { showToast } from './utils.js';
import { getCompanySettings } from './company-settings.js';

// Cached company settings
let cachedCompany = null;

/**
 * Get company settings for PDF generation
 */
async function getCompanyInfo() {
    if (!cachedCompany) {
        try {
            cachedCompany = await getCompanySettings();
        } catch (err) {
            console.warn("Failed to fetch company settings, using defaults", err);
            cachedCompany = {};
        }
    }
    return {
        name: cachedCompany?.name || "NOBHO",
        tagline: cachedCompany?.tagline || "Interior Design Studio",
        email: cachedCompany?.email || "",
        phone: cachedCompany?.phone || "",
        address: cachedCompany?.address || "",
        logo: cachedCompany?.logoUrl || "/assets/images/Logoforinvoice.png",
        currencySymbol: cachedCompany?.currencySymbol || "৳",
        bankName: cachedCompany?.bankName || "",
        bankAccountName: cachedCompany?.bankAccountName || "",
        bankAccountNumber: cachedCompany?.bankAccountNumber || "",
        bankBranch: cachedCompany?.bankBranch || ""
    };
}

/**
 * Generate HTML template for invoice PDF
 */
function generateInvoiceHTML(invoice, customer, company, creationDate = new Date()) {
    const formatCurrency = (amount) => '৳' + (amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const itemsHTML = (invoice.items || []).map((item, idx) => `
        <tr>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 11px;">${idx + 1}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
                <div style="font-weight: 500;">${item.description || ''}</div>
            </td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #475569;">${capitalize(item.boqCategory) || '-'}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #475569;">${item.phase || '-'}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #475569;">${item.location || '-'}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 11px;">${item.qty || 0}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 11px;">${item.unit || 'pcs'}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 11px;">${formatCurrency(item.unitPrice)}</td>
            <td style="padding: 10px 5px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-size: 11px;">${formatCurrency(item.total)}</td>
        </tr>
    `).join('');

    const paymentsHTML = (invoice.payments || []).length > 0 ? `
        <div style="margin-top: 30px; padding: 20px; background: #f8fafb; border-radius: 8px;">
            <h3 style="margin: 0 0 15px; font-size: 14px; color: #163A64; text-transform: uppercase; letter-spacing: 1px;">Payment History</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #e5e7eb;">
                        <th style="padding: 8px; text-align: left;">Date</th>
                        <th style="padding: 8px; text-align: left;">Method</th>
                        <th style="padding: 8px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.payments.map(p => `
                        <tr>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(p.date)}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-transform: capitalize;">${p.method || 'Cash'}</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(p.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    return `
        <div id="invoice-pdf-content" style="font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #163A64; background: white;">
            
            <!-- Header (Centered & Scaling Optimized) -->
            <div style="text-align: center; margin-bottom: 35px; padding-bottom: 25px; border-bottom: 2px solid #00C9BC;">
                <div style="margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                    ${company.logo ? `
                        <img src="${company.logo}" alt="Logo" style="display: block; max-height: 80px; width: auto; max-width: 250px; object-fit: contain;">
                    ` : `
                        <div style="padding: 10px 0;">
                            <h1 style="margin: 0; font-size: 32px; color: #163A64; letter-spacing: 2px; font-weight: 700;">${company.name}</h1>
                            <p style="margin: 4px 0 0; color: #00C9BC; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${company.tagline}</p>
                        </div>
                    `}
                </div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 15px;">
                    <p style="margin: 0; font-weight: 500;">${company.address}</p>
                    <p style="margin: 4px 0;">Phone: ${company.phone} | Email: ${company.email}</p>
                </div>
            </div>
            
            <!-- Invoice Title & Meta -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 35px;">
                <div>
                    <h2 style="margin: 0 0 5px; font-size: 30px; font-weight: 700; color: #163A64; letter-spacing: -0.5px;">
                        ${(invoice.status || 'draft') === 'draft' ? 'DRAFT INVOICE' : 'TAX INVOICE'}
                    </h2>
                    <p style="margin: 0; font-size: 15px; color: #00C9BC; font-weight: 600;">${invoice.invoiceNumber || 'NEW DRAFT'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 13px; color: #64748b;">
                        <strong>Date:</strong> ${formatDate(invoice.date)}
                    </p>
                    ${invoice.dueDate ? `
                        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">
                            <strong>Due Date:</strong> ${formatDate(invoice.dueDate)}
                        </p>
                    ` : ''}
                    <p style="margin: 8px 0 0; padding: 4px 12px; background: ${invoice.status === 'paid' ? '#dcfce7' : invoice.status === 'draft' ? '#f1f5f9' : '#dbeafe'}; 
                        color: ${invoice.status === 'paid' ? '#166534' : invoice.status === 'draft' ? '#64748b' : '#1e40af'}; 
                        border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block;">
                        ${(invoice.status || 'draft').replace('_', ' ')}
                    </p>
                </div>
            </div>
            
            <!-- Compact Bill To -->
            <div style="margin-bottom: 35px; padding: 18px; background: #f8fafb; border-radius: 8px; border-left: 4px solid #00C9BC; display: flex; gap: 30px; align-items: flex-start;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Bill To</h3>
                    <p style="margin: 0; font-size: 17px; font-weight: 700; color: #163A64;">${customer?.name || invoice.customerSnapshot?.name || 'N/A'}</p>
                    ${(customer?.company || invoice.customerSnapshot?.company) ? `<p style="margin: 4px 0 0; color: #475569; font-weight: 500;">${customer?.company || invoice.customerSnapshot?.company}</p>` : ''}
                </div>
                <div style="flex: 1; font-size: 13px; color: #475569; line-height: 1.6; padding-top: 18px;">
                    ${(customer?.email || invoice.customerSnapshot?.email) ? `<p style="margin: 0;"><strong>Email:</strong> ${customer?.email || invoice.customerSnapshot?.email}</p>` : ''}
                    ${customer?.phone ? `<p style="margin: 2px 0;"><strong>Phone:</strong> ${customer.phone}</p>` : ''}
                    ${customer?.billingAddress ? `<p style="margin: 2px 0;"><strong>Address:</strong> ${customer.billingAddress}</p>` : ''}
                </div>
            </div>
            
            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #00C9BC 0%, #007A73 100%); color: white;">
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">SL</th>
                        <th style="padding: 10px 5px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">BOQ</th>
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Phase</th>
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Location</th>
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                        <th style="padding: 10px 5px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Unit</th>
                        <th style="padding: 10px 5px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Rate</th>
                        <th style="padding: 10px 5px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>
            
            <!-- Totals -->
            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 300px;">
                    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6B7A8C;">Subtotal</span>
                        <span style="font-weight: 500;">${formatCurrency(invoice.subtotal)}</span>
                    </div>
                    ${invoice.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6B7A8C;">Discount ${invoice.discountType === 'percent' ? `(${invoice.discount}%)` : ''}</span>
                            <span style="color: #10b981;">-${formatCurrency(invoice.discountType === 'percent' ? (invoice.subtotal * invoice.discount / 100) : invoice.discount)}</span>
                        </div>
                    ` : ''}
                    ${invoice.tax > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                            <span style="color: #6B7A8C;">Tax/VAT (${invoice.taxRate}%)</span>
                            <span>${formatCurrency(invoice.tax)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 15px 0; margin-top: 5px; border-top: 3px solid #00C9BC;">
                        <span style="font-size: 16px; font-weight: 700; color: #163A64;">Grand Total</span>
                        <span style="font-size: 18px; font-weight: 700; color: #00C9BC;">${formatCurrency(invoice.total)}</span>
                    </div>
                    ${invoice.totalPaid > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                            <span style="color: #10b981;">Amount Paid</span>
                            <span style="color: #10b981; font-weight: 600;">${formatCurrency(invoice.totalPaid)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px 15px; background: ${(invoice.dueAmount || 0) > 0 ? '#fee2e2' : '#dcfce7'}; border-radius: 8px;">
                            <span style="font-weight: 600; color: ${(invoice.dueAmount || 0) > 0 ? '#dc2626' : '#16a34a'};">
                                ${(invoice.dueAmount || 0) > 0 ? 'Balance Due' : 'Paid in Full'}
                            </span>
                            <span style="font-weight: 700; color: ${(invoice.dueAmount || 0) > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(invoice.dueAmount)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            ${paymentsHTML}
            
            <!-- Terms & Notes -->
            ${invoice.terms || invoice.notes ? `
                <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                    ${invoice.terms ? `
                        <div style="margin-bottom: 20px;">
                            <h3 style="margin: 0 0 10px; font-size: 12px; color: #6B7A8C; text-transform: uppercase; letter-spacing: 1px;">Terms & Conditions</h3>
                            <div style="margin: 0; font-size: 13px; color: #6B7A8C; white-space: pre-line;">${invoice.terms}</div>
                        </div>
                    ` : ''}
                    ${invoice.notes ? `
                        <div>
                            <h3 style="margin: 0 0 10px; font-size: 12px; color: #6B7A8C; text-transform: uppercase; letter-spacing: 1px;">Notes</h3>
                            <div style="margin: 0; font-size: 13px; color: #6B7A8C; white-space: pre-line;">${invoice.notes}</div>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <!-- Footer -->
            <div style="margin-top: 50px; text-align: center; padding-top: 25px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: 500;">Thank you for your business!</p>
                <div style="margin-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: center; gap: 15px;">
                    <span>Generated by ${company.name} Invoice System</span>
                    <span>•</span>
                    <span>Created: ${creationDate.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Preview invoice in a modal
 */
export async function previewInvoice(invoiceId) {
    try {
        const invoice = await getInvoice(invoiceId);
        const company = await getCompanyInfo();
        const customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        const html = generateInvoiceHTML(invoice, customer, company);

        const modal = document.createElement('div');
        modal.className = 'modal ims-modal invoice-preview-modal';
        modal.innerHTML = `
            <div class="modal-content ims-modal-content" style="max-width: 900px; max-height: 95vh; overflow: auto;">
                <div class="modal-header ims-modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <h2><i class="material-icons-round">preview</i> Invoice Preview</h2>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-primary-ims" id="downloadPdfBtn">
                            <i class="material-icons-round">picture_as_pdf</i> PDF
                        </button>
                        <button class="btn-primary-ims" id="downloadImageBtn" style="background: #8b5cf6;">
                            <i class="material-icons-round">image</i> Image
                        </button>
                        <button class="btn-primary-ims" id="sendEmailBtn" style="background: #10b981;">
                            <i class="material-icons-round">email</i> Email
                        </button>
                        <button class="btn-secondary-ims" id="printBtn">
                            <i class="material-icons-round">print</i> Print
                        </button>
                        <button class="modal-close" style="font-size: 1.5rem; background: none; border: none; cursor: pointer;">&times;</button>
                    </div>
                </div>
                <div id="invoice-preview-container" style="padding: 20px; background: #f1f5f9;">
                    <div id="invoice-actual-render" style="background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 4px;">
                        ${html}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Download PDF
        modal.querySelector('#downloadPdfBtn').addEventListener('click', () => {
            downloadInvoicePDF(invoice, customer);
        });

        // Download Image
        modal.querySelector('#downloadImageBtn').addEventListener('click', () => {
            downloadInvoiceImage(invoice, customer);
        });

        // Send Email
        modal.querySelector('#sendEmailBtn').addEventListener('click', () => {
            sendInvoiceEmail(invoice, customer);
        });

        // Print
        modal.querySelector('#printBtn').addEventListener('click', () => {
            printInvoice(invoice, customer);
        });

    } catch (error) {
        console.error("Error previewing invoice:", error);
        showToast("Failed to preview invoice", "error");
    }
}

/**
 * Preview invoice directly from data (for live previews in editor)
 */
/**
 * Preview invoice directly from data (for live previews in editor OR snapshots)
 */
export async function previewInvoiceFromData(data, options = {}) {
    try {
        const company = options.companyOverride || await getCompanyInfo();
        // If data has customerSnapshot, use it, otherwise use null (it might be in data)
        const customer = data.customerSnapshot || data;

        // Use frozen timestamp if provided (snapshot viewing), otherwise now
        const creationDate = options.creationDate || new Date();

        const html = generateInvoiceHTML(data, customer, company, creationDate);

        const modal = document.createElement('div');
        modal.className = 'modal ims-modal invoice-preview-modal';
        modal.innerHTML = `
            <div class="modal-content ims-modal-content" style="max-width: 900px; max-height: 95vh; overflow: auto;">
                <div class="modal-header ims-modal-header" style="position: sticky; top: 0; background: white; z-index: 10;">
                    <h2><i class="material-icons-round">preview</i> ${options.title || 'Invoice Preview'}</h2>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn-primary-ims" id="downloadPdfBtn">
                            <i class="material-icons-round">picture_as_pdf</i> PDF
                        </button>
                        <button class="btn-primary-ims" id="downloadImageBtn" style="background: #8b5cf6;">
                            <i class="material-icons-round">image</i> Image
                        </button>
                        <button class="btn-primary-ims" id="sendEmailBtn" style="background: #10b981;">
                            <i class="material-icons-round">email</i> Email
                        </button>
                        <button class="btn-secondary-ims" id="printBtn">
                            <i class="material-icons-round">print</i> Print
                        </button>
                        <button class="modal-close" style="font-size: 1.5rem; background: none; border: none; cursor: pointer;">&times;</button>
                    </div>
                </div>
                <div id="invoice-preview-container" style="padding: 20px; background: #f1f5f9;">
                    <div id="invoice-actual-render" style="background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 4px;">
                        ${html}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        // Pass overrides to download functions
        const dlOptions = {
            logExport: options.logExport !== undefined ? options.logExport : true,
            companyOverride: company,
            creationDate: creationDate // Pass the same timestamp for downloads
        };

        modal.querySelector('#downloadPdfBtn').addEventListener('click', () => downloadInvoicePDF(data, customer, dlOptions));
        modal.querySelector('#downloadImageBtn').addEventListener('click', () => downloadInvoiceImage(data, customer, dlOptions));
        modal.querySelector('#sendEmailBtn').addEventListener('click', () => sendInvoiceEmail(data, customer)); // Email doesn't usually use overrides yet but good to note
        modal.querySelector('#printBtn').addEventListener('click', () => printInvoice(data, customer, dlOptions));

    } catch (error) {
        console.error("Error in direct preview:", error);
        showToast("Failed to generate preview", "error");
    }
}

/**
 * Download invoice as PDF
 */
export async function downloadInvoicePDF(invoiceOrId, customer = null, options = {}) {
    let container = null; // Declare outside try/catch for finally access
    try {
        let invoice = invoiceOrId;
        if (typeof invoiceOrId === 'string') {
            invoice = await getInvoice(invoiceOrId);
            if (!invoice) {
                showToast("Invoice not found", "error");
                return;
            }
            customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        }

        showToast("Generating PDF...", "neutral");

        // Use override if provided (for viewing historical snapshots), otherwise fetch
        const company = options.companyOverride || await getCompanyInfo();
        const creationDate = options.creationDate || new Date();

        const html = generateInvoiceHTML(invoice, customer, company, creationDate);
        container = document.createElement('div'); // Assign to outer variable
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.innerHTML = html;
        document.body.appendChild(container);

        // Optimize logo for strict scaling (fixes zoom issues)
        await optimizeLogoForExport(container);

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `${invoice.invoiceNumber || 'invoice'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Ensure html2pdf is available
        if (typeof html2pdf === 'undefined') {
            showToast("PDF Library not loaded. Please refresh.", "error");
            document.body.removeChild(container);
            return;
        }

        await html2pdf().set(opt).from(container.firstElementChild).save();

        document.body.removeChild(container);
        showToast("PDF downloaded successfully!", "success");

        // Log the export if not viewing a snapshot (default true)
        if (options.logExport !== false) {
            await logInvoiceExport(invoice.id, 'pdf', {
                invoice,
                customer,
                company,
                timestamp: creationDate.toISOString() // Log the exact time shown on the PDF
            });
        }

    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast("Failed to generate PDF", "error");
    } finally {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }
}

/**
 * Helper to ensure logo is scaled correctly for html2canvas
 * @param {HTMLElement} container 
 */
async function optimizeLogoForExport(container) {
    const logoImg = container.querySelector('img[alt="Logo"]');
    if (!logoImg) return;

    // Wait for image to load to get natural dimensions
    if (!logoImg.complete) {
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
        });
    }

    const MAX_W = 280;
    const MAX_H = 80;
    const naturalW = logoImg.naturalWidth || 1;
    const naturalH = logoImg.naturalHeight || 1;

    // Calculate best fit (contain)
    const scale = Math.min(MAX_W / naturalW, MAX_H / naturalH, 1); // Never upscale

    const finalW = Math.floor(naturalW * scale);
    const finalH = Math.floor(naturalH * scale);

    // Apply strict dimensions that html2canvas will respect
    logoImg.style.width = `${finalW}px`;
    logoImg.style.height = `${finalH}px`;
    logoImg.style.maxWidth = 'none';
    logoImg.style.maxHeight = 'none';
    logoImg.style.minHeight = '0';
    logoImg.style.minWidth = '0';
    logoImg.style.objectFit = 'fill'; // We already calculated aspect ratio
}

/**
 * Download invoice as Image
 */
export async function downloadInvoiceImage(invoiceOrId, customer = null, options = {}) {
    let container = null;
    try {
        let invoice = invoiceOrId;
        if (typeof invoiceOrId === 'string') {
            invoice = await getInvoice(invoiceOrId);
            if (!invoice) {
                showToast("Invoice not found", "error");
                return;
            }
            customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        }

        showToast("Generating Image...", "neutral");

        const company = options.companyOverride || await getCompanyInfo();
        const creationDate = options.creationDate || new Date();

        const html = generateInvoiceHTML(invoice, customer, company, creationDate);
        container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.innerHTML = html;
        document.body.appendChild(container);

        // Optimize Logo
        await optimizeLogoForExport(container);

        // html2pdf bundle includes html2canvas
        if (typeof html2canvas === 'undefined') {
            // If not global, it might be inside html2pdf or we need to wait
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            document.head.appendChild(script);
            await new Promise(r => script.onload = r);
        }

        const canvas = await html2canvas(container.firstElementChild, {
            scale: 2, // Slightly lower scale for better performance/compatibility
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true
        });

        const link = document.createElement('a');
        link.download = `${invoice.invoiceNumber || 'invoice'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast("Image downloaded successfully!", "success");

        if (options.logExport !== false) {
            await logInvoiceExport(invoice.id, 'image', {
                invoice,
                customer,
                company,
                timestamp: creationDate.toISOString()
            });
        }

    } catch (error) {
        console.error("Error generating Image:", error);
        showToast("Failed to generate Image", "error");
    } finally {
        if (container && document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }
}

/**
 * Print invoice
 */
export async function printInvoice(invoice, customer = null, options = {}) {
    const company = options.companyOverride || await getCompanyInfo();
    const creationDate = options.creationDate || new Date();

    const html = generateInvoiceHTML(invoice, customer, company, creationDate);

    if (options.logExport !== false) {
        logInvoiceExport(invoice.id, 'print', {
            invoice,
            customer,
            company,
            timestamp: creationDate.toISOString()
        });
    }
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${invoice.invoiceNumber} - Print</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0; }
                    @page { margin: 15mm; }
                }
            </style>
        </head>
        <body>
            ${html}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() { window.close(); };
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Send invoice via email (Placeholder)
 */
export async function sendInvoiceEmail(invoice, customer = null) {
    try {
        if (!customer && invoice.customerId) {
            const { getCustomer } = await import('./customers.js');
            customer = await getCustomer(invoice.customerId);
        }

        const email = customer?.email || invoice.customerSnapshot?.email;
        if (!email) {
            showToast("Customer email not found", "error");
            return;
        }

        showToast(`Preparing email for ${email}...`, "neutral");

        // Simulating email API call
        setTimeout(() => {
            showToast(`Invoice ${invoice.invoiceNumber} sent to ${email}`, "success");
        }, 1500);

    } catch (error) {
        console.error("Error sending email:", error);
        showToast("Failed to send email", "error");
    }
}

// Make functions available globally
window.previewInvoice = previewInvoice;
window.previewInvoiceFromData = previewInvoiceFromData;
window.downloadInvoicePDF = downloadInvoicePDF;
window.downloadInvoiceImage = downloadInvoiceImage;
window.sendInvoiceEmail = sendInvoiceEmail;
