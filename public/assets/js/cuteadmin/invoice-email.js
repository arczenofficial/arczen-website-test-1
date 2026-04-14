// Invoice Email Module - Placeholder for Email Sending
import { getInvoice } from './invoices.js';
import { getCustomer } from './customers.js';
import { getCompanySettings } from './company-settings.js';
import { showToast } from './utils.js';

/**
 * Send invoice via email (placeholder)
 * In production, this would integrate with an email service
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<boolean>}
 */
export async function sendInvoiceEmail(invoiceId) {
    try {
        const invoice = await getInvoice(invoiceId);
        if (!invoice) {
            showToast("Invoice not found", "error");
            return false;
        }

        const customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        const company = await getCompanySettings();

        if (!customer?.email) {
            showToast("Customer has no email address", "error");
            return false;
        }

        // In production, this would call a cloud function or API
        // For now, show a placeholder modal

        const modal = document.createElement('div');
        modal.className = 'modal ims-modal email-modal';
        modal.innerHTML = `
            <div class="modal-content ims-modal-content" style="max-width: 500px;">
                <div class="modal-header ims-modal-header">
                    <h2><i class="material-icons-round">email</i> Send Invoice Email</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="ims-form" style="padding: 1.5rem;">
                    <div class="input-group-ims">
                        <label>To</label>
                        <input type="email" id="emailTo" value="${customer.email}" readonly style="background: #f1f5f9;">
                    </div>
                    <div class="input-group-ims">
                        <label>Subject</label>
                        <input type="text" id="emailSubject" value="Invoice ${invoice.invoiceNumber} from ${company.name}">
                    </div>
                    <div class="input-group-ims">
                        <label>Message</label>
                        <textarea id="emailMessage" rows="5">Dear ${customer.name},

Please find attached invoice ${invoice.invoiceNumber} for ৳${invoice.total?.toLocaleString()}.

Due Date: ${invoice.dueDate || 'Upon receipt'}

Thank you for your business!

${company.name}
${company.email}
${company.phone}</textarea>
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                            <i class="material-icons-round" style="font-size: 1rem; vertical-align: middle;">info</i>
                            Email sending requires backend integration. This is a preview of the email that would be sent.
                        </p>
                    </div>
                    <div class="modal-actions ims-modal-actions">
                        <button type="button" class="btn-secondary modal-close">Cancel</button>
                        <button type="button" class="btn-primary-ims" id="sendEmailBtn">
                            <i class="material-icons-round">send</i> Send Email
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => modal.remove()));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        // Send button (placeholder)
        document.getElementById('sendEmailBtn').addEventListener('click', () => {
            showToast("Email sending requires backend integration. Email preview copied to clipboard!", "neutral");

            // Copy to clipboard
            const emailContent = `To: ${customer.email}\nSubject: ${document.getElementById('emailSubject').value}\n\n${document.getElementById('emailMessage').value}`;
            navigator.clipboard.writeText(emailContent).catch(() => { });

            modal.remove();
        });

        return true;
    } catch (error) {
        console.error("Error preparing email:", error);
        showToast("Failed to prepare email", "error");
        return false;
    }
}

/**
 * Generate WhatsApp share link for invoice
 * @param {string} invoiceId - Invoice ID
 */
export async function shareInvoiceWhatsApp(invoiceId) {
    try {
        const invoice = await getInvoice(invoiceId);
        if (!invoice) {
            showToast("Invoice not found", "error");
            return;
        }

        const customer = invoice.customerId ? await getCustomer(invoice.customerId) : null;
        const company = await getCompanySettings();

        const message = encodeURIComponent(
            `Hello ${customer?.name || 'there'},\n\n` +
            `Here is your invoice ${invoice.invoiceNumber} from ${company.name}:\n` +
            `Total: ৳${invoice.total?.toLocaleString()}\n` +
            `Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon receipt'}\n\n` +
            `Thank you!\n${company.name}`
        );

        const phone = customer?.phone ? customer.phone.replace(/\D/g, '') : '';
        const whatsappUrl = phone
            ? `https://wa.me/${phone}?text=${message}`
            : `https://wa.me/?text=${message}`;

        window.open(whatsappUrl, '_blank');

    } catch (error) {
        console.error("Error sharing on WhatsApp:", error);
        showToast("Failed to share", "error");
    }
}

// Make functions available globally
window.sendInvoiceEmail = sendInvoiceEmail;
window.shareInvoiceWhatsApp = shareInvoiceWhatsApp;
