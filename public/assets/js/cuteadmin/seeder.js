import { 
    collection, addDoc, serverTimestamp, doc, setDoc, writeBatch, getDocs, query, limit, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';

const DEMO_CUSTOMERS = [
    { name: "Zahin Ahmed", email: "zahin@arczen.digital", phone: "01712345678", company: "Z-Tech Solutions", status: "current" },
    { name: "Tahzeeb Hasan", email: "tahzeeb@pixel.com", phone: "01823456789", company: "Pixel Artistry", status: "current" },
    { name: "Kishor Kumar", email: "kishor@lux.co", phone: "01934567890", company: "Lux Fragrances", status: "current" },
    { name: "Maliha Rahman", email: "maliha@vogue.net", phone: "01645678901", company: "Vogue Digital", status: "current" },
    { name: "Sifat Karim", email: "sifat@core.io", phone: "01556789012", company: "Core Infrastructure", status: "current" },
    { name: "Anika Tabassum", email: "anika@design.hub", phone: "01367890123", company: "Design Hub BD", status: "current" }
];

const DEMO_PRODUCTS = [
    { name: "Imperial Oudh - Special Edition", slug: "oud-imp-01", category: "perfume", price: 12500, price_6ml: 12500, sourcing_cost_usd: 85, featured: true, image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&q=80&w=200" },
    { name: "Black Saffron Digital Key", slug: "saf-blk-dk", category: "digital", price: 4500, price_6ml: 4500, sourcing_cost_usd: 21, featured: true, image: "https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&q=80&w=200" },
    { name: "Leather Knight - Exclusive Lock", slug: "lea-kni-el", category: "digital", price: 8900, price_6ml: 8900, sourcing_cost_usd: 54, featured: false, image: "https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&q=80&w=200" },
    { name: "Velvet Rose Genesis", slug: "rose-gen-01", category: "perfume", price: 1500, price_6ml: 1500, sourcing_cost_usd: 6, featured: true, image: "https://images.unsplash.com/photo-1557170334-a7c3c4675841?auto=format&fit=crop&q=80&w=200" },
    { name: "Midnight Musk - Pro Series", slug: "musk-mid-pro", category: "digital", price: 21000, price_6ml: 21000, sourcing_cost_usd: 140, featured: true, image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&q=80&w=200" }
];

const DEMO_TREASURY = [
    { name: "Brac Bank Main", type: "bank", balance: 450000 },
    { name: "Office Vault (Cash)", type: "cash", balance: 125000 },
    { name: "Bkash Merchant", type: "digital", balance: 89000 }
];

export const Seeder = {
    async seedAll() {
        console.log("%c[Seeder] COMMENCING GLOBAL DATA INJECTION...", "color: #00C9BC; font-weight: bold;");
        
        try {
            await this.seedCustomers();
            await this.seedTreasury();
            const products = await this.seedProducts();
            await this.seedOrders(products);
            console.log("%c[Seeder] GLOBAL UPLINK COMPLETE. TERMINAL READY.", "color: #10b981; font-weight: bold;");
            return true;
        } catch (e) {
            console.error("[Seeder] Injection Interrupted:", e);
            return false;
        }
    },

    async seedCustomers() {
        console.log("[Seeder] Injecting Counterparty Data...");
        for (const c of DEMO_CUSTOMERS) {
            await addDoc(collection(db, "customers"), {
                ...c,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    },

    async seedProducts() {
        console.log("[Seeder] Mapping Asset Index & Warehouse...");
        const createdProducts = [];
        for (const p of DEMO_PRODUCTS) {
            const docRef = await addDoc(collection(db, "products"), {
                ...p,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            // Initialize Inventory
            await setDoc(doc(db, "inventory", docRef.id), {
                stock: Math.floor(Math.random() * 100) + 10,
                updatedAt: serverTimestamp()
            });
            createdProducts.push({ id: docRef.id, ...p });
        }
        return createdProducts;
    },

    async seedTreasury() {
        console.log("[Seeder] Stabilizing Liquid Capital Pools...");
        for (const t of DEMO_TREASURY) {
            await addDoc(collection(db, "treasury"), {
                ...t,
                updatedAt: serverTimestamp()
            });
        }
    },

    async seedOrders(products) {
        console.log("[Seeder] Simulating Signal Stream (Orders)...");
        const now = new Date();
        
        for (let i = 0; i < 40; i++) {
            // Random date in the last 30 days
            const orderDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
            const customer = DEMO_CUSTOMERS[Math.floor(Math.random() * DEMO_CUSTOMERS.length)];
            const product = products[Math.floor(Math.random() * products.length)];
            const qty = Math.floor(Math.random() * 3) + 1;
            
            const [y, m, d] = [
                orderDate.getFullYear(),
                ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][orderDate.getMonth()],
                orderDate.getDate().toString().padStart(2, '0')
            ];
            
            const path = `orders/${y}/${m}/${d}/items`;
            const status = Math.random() > 0.3 ? 'delivered' : (Math.random() > 0.5 ? 'confirmed' : 'pending');
            
            const amount = product.price * qty;
            const cost = product.cost * qty;

            await addDoc(collection(db, path), {
                customerId: "DEMO_ID", // Simple demo ref
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                items: [{
                    productId: product.id,
                    title: product.title,
                    price: product.price,
                    cost: product.cost,
                    quantity: qty,
                    variant: "Standard"
                }],
                amount: amount,
                cost: cost,
                status: status,
                category: 'digital',
                createdAt: orderDate, 
                updatedAt: orderDate
            });
        }
    },

    async clearExistingData() {
        console.warn("[Seeder] DATA WIPEOUT INITIATED...");
        // This is a safety method, use with caution.
        // It's hard to recursive delete in web SDK without Cloud Functions, 
        // but for demo we can clear customers and products.
        const custs = await getDocs(collection(db, "customers"));
        for (const d of custs.docs) await deleteDoc(d.ref);
        
        const prods = await getDocs(collection(db, "products"));
        for (const d of prods.docs) await deleteDoc(d.ref);
        
        console.log("[Seeder] Wipeout complete.");
    }
};

window.Seeder = Seeder;
