export const prerender = false;
import type { APIRoute } from 'astro';
import { adminDb, adminAuth } from '../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 🔒 ZERO TRUST CHECKOUT ENDPOINT
 * 
 * This endpoint processes orders purely on the server.
 * Instead of trusting the client to send us "Total: $10.00", the client
 * just sends the Product IDs. The server looks up the true prices in the Database.
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { 
            customerId, 
            customerName,
            customerPhone,
            deliveryAddress, 
            items, 
            paymentMethod, 
            paymentSender, 
            paymentTrxId,
            currency = 'bdt'
        } = body;

        if (!customerId || !items || !items.length) {
            return new Response(JSON.stringify({ error: 'Invalid checkout payload' }), { status: 400 });
        }

        // --- BACKEND VALIDATION FOR EMAIL VERIFICATION ---
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            if (!decodedToken.email_verified) {
                return new Response(JSON.stringify({ error: 'Email not verified. Please verify your email before placing an order.' }), { status: 403 });
            }
            if (decodedToken.uid !== customerId && customerId !== 'guest') {
                return new Response(JSON.stringify({ error: 'Unauthorized: Token does not match customer' }), { status: 403 });
            }
        } catch (err: any) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), { status: 401 });
        }
        // --- END BACKEND VALIDATION ---

        // 1. Fetch Global Settings & Specific Product/Inventory Data
        const itemsToFetch = Array.from(new Set(items.map((i: any) => i.productId)));
        
        const [settingsSnap, ...snaps] = await Promise.all([
            adminDb.collection('settings').doc('company').get(),
            ...itemsToFetch.map(id => adminDb.collection('products').doc(id as string).get()),
            ...itemsToFetch.map(id => adminDb.collection('inventory').doc(id as string).get())
        ]);

        const settings = settingsSnap.data() || { bdtUsdRate: 120, bkashFee: 0, nagadFee: 0, usdPaymentFee: 0 };
        const bdtRate = settings.bdtUsdRate || 120;
        
        // Map snaps for easy indexing
        const productSnaps = snaps.slice(0, itemsToFetch.length);
        const inventorySnaps = snaps.slice(itemsToFetch.length);
        
        const productsMap = new Map();
        productSnaps.forEach(snap => {
            if (snap.exists) productsMap.set(snap.id, snap.data());
        });
        
        const inventoryMap = new Map();
        inventorySnaps.forEach(snap => {
            if (snap.exists) inventoryMap.set(snap.id, snap.data());
        });

        let subtotalBdt = 0;
        let totalCostBdt = 0;
        const validItems = [];

        for (const item of items) {
            const p = productsMap.get(item.productId);
            const inv = inventoryMap.get(item.productId); // undefined if no inventory doc

            if (!p) {
                console.error(`[Checkout] Product not found in Firestore: "${item.productId}"`);
                return new Response(JSON.stringify({ error: `Product "${item.productId}" not found. Please refresh the page and try again.` }), { status: 400 });
            }

            // Only enforce stock limit when an inventory document actively tracks stock
            if (inv && typeof inv.stock === 'number' && inv.stock < item.quantity) {
                return new Response(JSON.stringify({ error: `Insufficient stock for ${p.title}. Only ${inv.stock} unit(s) available.` }), { status: 400 });
            }

            const truePrice = p.on_sale && p.sale_price ? p.sale_price : p.price;
            const costPerItem = p.cost || (truePrice * 0.4);

            subtotalBdt += (truePrice * item.quantity);
            totalCostBdt += (costPerItem * item.quantity);

            validItems.push({
                productId: item.productId,
                title: p.title,
                price: truePrice,
                cost: costPerItem,
                quantity: item.quantity,
                variant: item.variant || 'Standard'
            });
        }

        // 2. Calculations (no delivery fee — digital/online product)
        const isUSD = currency.toLowerCase() === 'usd';
        const deliveryFeeBdt = 0; // Online delivery, no physical shipping
        
        const feePercent = isUSD 
            ? (settings.usdPaymentFee || 0) 
            : (paymentMethod === 'nagad' ? (settings.nagadFee || 0) : (settings.bkashFee || 0));
        
        const baseAmount = isUSD ? (subtotalBdt / bdtRate) : subtotalBdt;
        const processingCharge = baseAmount * (feePercent / 100);
        const totalFinal = baseAmount + processingCharge;

        // 3. Write Order
        const now = new Date();
        const year = now.getFullYear().toString();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = months[now.getMonth()];
        const day = now.getDate().toString().padStart(2, '0');

        // We use two locations for orders:
        // 1. Nested (for Admin terminal's daily/monthly view)
        // 2. Root (for User Profile query compatibility)
        const orderRef = adminDb.collection('orders').doc(year).collection(month).doc(day).collection('items').doc();
        const globalOrderRef = adminDb.collection('orders').doc(orderRef.id);
        
        const orderData = {
            id: orderRef.id,
            fullPath: `orders/${year}/${month}/${day}/items/${orderRef.id}`,
            globalPath: `orders/${orderRef.id}`,
            orderNumber: `ORD-${Date.now()}`,
            customerId,
            customerName,
            customerPhone,
            deliveryAddress,
            items: validItems,
            subtotal: isUSD ? (subtotalBdt / bdtRate) : subtotalBdt,
            deliveryFee: isUSD ? 0 : deliveryFeeBdt,
            processingCharge: processingCharge,
            amount: totalFinal,
            totalAmount: totalFinal,
            currency: currency.toUpperCase(),
            paymentMethod,
            paymentSender,
            paymentTrxId,
            paymentStatus: 'pending',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        const batch = adminDb.batch();
        batch.set(orderRef, orderData);
        batch.set(globalOrderRef, orderData);
        
        await batch.commit();

        return new Response(JSON.stringify({ 
            success: true, 
            orderId: orderRef.id,
            totalCharged: totalFinal 
        }), { status: 200 });

    } catch (error: any) {
        console.error('❌ [Checkout API Error]:', error);
        return new Response(JSON.stringify({ 
            error: error?.message || 'Internal Server Error',
            details: error?.stack 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
