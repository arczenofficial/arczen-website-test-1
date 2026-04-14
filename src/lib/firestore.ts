/**
 * Server-side Firestore data fetchers
 * ─────────────────────────────────────
 * All functions here run on the SERVER only (Astro SSR).
 * Data is fetched from Firestore and passed as props to Astro pages.
 * The raw Firestore documents are never streamed to the browser —
 * only the final rendered HTML reaches the user.
 */
import { adminDb } from './firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Product {
    id: string;
    slug: string;
    title: string;
    image: string;
    images: string[];
    // Pricing
    price?: number;               // Flat single price
    price_6ml?: number;
    price_15ml?: number;
    originalPrice?: number;
    // Sale
    on_sale: boolean;
    sale_price?: number;
    sale_price_6ml?: number;
    sale_price_15ml?: number;
    offer_label?: string;
    offer_expires?: string;
    // Labels
    badge?: string;
    category?: string;
    featured: boolean;
    new_arrival: boolean;
    bestseller: boolean;
    in_stock: boolean;
    stock_label?: string;
    // Fragrance fields
    top_notes?: string;
    heart_notes?: string;
    base_notes?: string;
    accords?: string;
    longevity?: string;
    projection?: string;
    // Display
    display_order: number;
    short_description?: string;
    description?: string;
    // Meta
    createdAt?: string;
    updatedAt?: string;
}

export interface Customer {
    uid: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    addresses: Address[];
    lastNameChange?: any; // Firestore Timestamp
    createdAt: string;
    lastLoginAt?: string;
    totalOrders: number;
    totalSpent: number;
    loyaltyPoints: number;
    isActive: boolean;
}

export interface Address {
    id: string;
    label: string;        // 'Home', 'Office', etc.
    street: string;
    city: string;
    district: string;
    zip?: string;
    isDefault: boolean;
}

export interface Order {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    items: OrderItem[];
    shippingAddress: Omit<Address, 'id' | 'label' | 'isDefault'>;
    subtotal: number;
    discount: number;
    deliveryFee: number;
    total: number;
    couponCode?: string;
    paymentMethod: 'cod' | 'bkash' | 'nagad' | 'card';
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
    statusHistory: StatusUpdate[];
    trackingNumber?: string;
    courierName?: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
}

export interface OrderItem {
    productId: string;
    title: string;
    image: string;
    price: number;
    quantity: number;
    variant?: string;
}

export interface StatusUpdate {
    status: string;
    note?: string;
    updatedBy: string;
    updatedAt: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function docToProduct(doc: QueryDocumentSnapshot): Product {
    const d = doc.data();
    return {
        id: doc.id,
        slug: d.slug || doc.id,
        title: d.title || '',
        image: d.image || '/images/placeholder.png',
        images: d.images || [],
        price: d.price,
        price_6ml: d.price_6ml,
        price_15ml: d.price_15ml,
        originalPrice: d.originalPrice,
        on_sale: d.on_sale || false,
        sale_price: d.sale_price,
        sale_price_6ml: d.sale_price_6ml,
        sale_price_15ml: d.sale_price_15ml,
        offer_label: d.offer_label,
        offer_expires: d.offer_expires,
        badge: d.badge,
        category: d.category,
        featured: d.featured || false,
        new_arrival: d.new_arrival || false,
        bestseller: d.bestseller || false,
        in_stock: d.in_stock !== false,
        stock_label: d.stock_label,
        top_notes: d.top_notes,
        heart_notes: d.heart_notes,
        base_notes: d.base_notes,
        accords: d.accords,
        longevity: d.longevity,
        projection: d.projection,
        display_order: d.display_order ?? 50,
        short_description: d.short_description,
        description: d.description,
        createdAt: d.createdAt?.toDate?.()?.toISOString(),
        updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
    };
}

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * Fetch all active (in_stock or all) products, sorted by display_order.
 */
export async function getProducts(options: {
    onlyInStock?: boolean;
    category?: string;
    limit?: number;
} = {}): Promise<Product[]> {
    let q = adminDb.collection('products').orderBy('display_order', 'asc');

    if (options.category) {
        q = q.where('category', '==', options.category) as any;
    }
    if (options.limit) {
        q = q.limit(options.limit) as any;
    }

    const snap = await q.get();
    let products = snap.docs.map(docToProduct);

    if (options.onlyInStock) {
        products = products.filter(p => p.in_stock);
    }

    return products;
}

/**
 * Fetch a single product by slug.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
    const snap = await adminDb
        .collection('products')
        .where('slug', '==', slug)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return docToProduct(snap.docs[0]);
}

/**
 * Fetch featured products.
 */
export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
    const snap = await adminDb
        .collection('products')
        .where('featured', '==', true)
        .orderBy('display_order', 'asc')
        .limit(limit)
        .get();

    return snap.docs.map(docToProduct);
}

/**
 * Fetch on-sale products.
 */
export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
    const snap = await adminDb
        .collection('products')
        .where('on_sale', '==', true)
        .orderBy('display_order', 'asc')
        .limit(limit)
        .get();

    return snap.docs.map(docToProduct);
}

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Fetch orders for a specific customer (server-side, authenticated context).
 */
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
    const snap = await adminDb
        .collection('orders')
        .where('customerId', '==', customerId)
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(doc => {
        const d = doc.data();
        return {
            id: doc.id,
            ...d,
            createdAt: d.createdAt?.toDate?.()?.toISOString() || '',
            updatedAt: d.updatedAt?.toDate?.()?.toISOString() || '',
        } as Order;
    });
}

/**
 * Fetch a single order by ID — validates it belongs to the requesting customer.
 */
export async function getOrderById(orderId: string, customerId: string): Promise<Order | null> {
    const doc = await adminDb.collection('orders').doc(orderId).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    // Security: only return if it belongs to this customer
    if (data.customerId !== customerId) return null;

    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || '',
    } as Order;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * Fetch customer profile by UID.
 */
export async function getCustomerProfile(uid: string): Promise<Customer | null> {
    const doc = await adminDb.collection('customers').doc(uid).get();
    if (!doc.exists) return null;

    const d = doc.data()!;
    return {
        uid: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || '',
        lastLoginAt: d.lastLoginAt?.toDate?.()?.toISOString(),
    } as Customer;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

/**
 * Fetch approved reviews for a product.
 */
export async function getProductReviews(productId: string) {
    const snap = await adminDb
        .collection('reviews')
        .where('productId', '==', productId)
        .where('isApproved', '==', true)
        .orderBy('createdAt', 'desc')
        .get();

    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || '',
    }));
}
