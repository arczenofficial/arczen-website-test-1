/**
 * Seed Script — Populate Firestore with digital product catalog
 * ─────────────────────────────────────────────────────────────
 * Run ONCE after setting up Firebase:
 *   node scripts/seed-products.js
 *
 * Requires .env with FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * FIREBASE_ADMIN_PRIVATE_KEY
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    try {
        const env = readFileSync(resolve(__dirname, '../.env'), 'utf-8');
        env.split('\n').forEach(line => {
            const [key, ...vals] = line.split('=');
            if (key && !key.startsWith('#')) {
                process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
    } catch {}
}
loadEnv();

initializeApp({
    credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = getFirestore();

// ─── Digital Product Catalog ──────────────────────────────────────────────────
const products = [
    // ── SUBSCRIPTIONS ──
    {
        slug: 'netflix-subscription',
        title: 'Netflix Subscription',
        image: '/images/products/netflix.png',
        images: [],
        category: 'subscription',
        price: 280,
        on_sale: false,
        variants: [
            { label: '1 Month', price: 280 },
            { label: '3 Months', price: 790 },
            { label: '6 Months', price: 1500 },
            { label: '1 Year', price: 2800 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Account credentials delivered within 2–6 hours',
        short_description: 'Stream unlimited movies, TV shows & more.',
        badge: '🎬 Streaming',
        featured: true,
        bestseller: true,
        new_arrival: false,
        in_stock: true,
        display_order: 1,
    },
    {
        slug: 'chatgpt-plus',
        title: 'ChatGPT Plus',
        image: '/images/products/chatgpt.png',
        images: [],
        category: 'subscription',
        price: 650,
        on_sale: false,
        variants: [
            { label: '1 Month', price: 650 },
            { label: '3 Months', price: 1850 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Account access delivered within 6 hours',
        short_description: 'Access GPT-4o, DALL·E, advanced analysis.',
        badge: '🤖 AI Tool',
        featured: true,
        bestseller: true,
        new_arrival: false,
        in_stock: true,
        display_order: 2,
    },
    {
        slug: 'spotify-premium',
        title: 'Spotify Premium',
        image: '/images/products/spotify.png',
        images: [],
        category: 'subscription',
        price: 180,
        on_sale: true,
        sale_price: 150,
        offer_label: '⚡ Flash Sale',
        variants: [
            { label: '1 Month', price: 180, sale_price: 150 },
            { label: '3 Months', price: 490, sale_price: 420 },
            { label: '6 Months', price: 900, sale_price: 780 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Upgraded within 3 hours',
        short_description: 'Ad-free music, offline listen, high quality.',
        badge: '🎵 Music',
        featured: true,
        bestseller: false,
        new_arrival: false,
        in_stock: true,
        display_order: 3,
    },
    {
        slug: 'canva-pro',
        title: 'Canva Pro',
        image: '/images/products/canva.png',
        images: [],
        category: 'subscription',
        price: 350,
        on_sale: false,
        variants: [
            { label: '1 Month', price: 350 },
            { label: '1 Year', price: 3500 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Team invite sent within 6 hours',
        short_description: 'Premium templates, brand kit, AI tools.',
        badge: '🎨 Design',
        featured: false,
        bestseller: false,
        new_arrival: true,
        in_stock: true,
        display_order: 4,
    },
    {
        slug: 'youtube-premium',
        title: 'YouTube Premium',
        image: '/images/products/youtube.png',
        images: [],
        category: 'subscription',
        price: 200,
        on_sale: false,
        variants: [
            { label: '1 Month', price: 200 },
            { label: '3 Months', price: 560 },
            { label: '6 Months', price: 1080 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Activated within 3 hours',
        short_description: 'Ad-free YouTube, YouTube Music, downloads.',
        badge: '▶️ Video',
        featured: false,
        bestseller: false,
        new_arrival: false,
        in_stock: true,
        display_order: 5,
    },

    // ── GAME TOP-UPS ──
    {
        slug: 'pubg-uc',
        title: 'PUBG Mobile UC',
        image: '/images/products/pubg.png',
        images: [],
        category: 'game-topup',
        price: 220,
        on_sale: false,
        variants: [
            { label: '60 UC',   price: 80 },
            { label: '165 UC',  price: 195 },
            { label: '325 UC',  price: 385 },
            { label: '660 UC',  price: 770 },
            { label: '1800 UC', price: 2100 },
        ],
        delivery_type: 'manual',
        delivery_info: 'UC added to your account within 30 minutes',
        short_description: 'Official PUBG Mobile UC top-up — any amount.',
        badge: '🎮 Game',
        featured: true,
        bestseller: true,
        new_arrival: false,
        in_stock: true,
        in_stock: true,
        display_order: 6,
    },
    {
        slug: 'val-1100',
        title: 'Valorant 1100 VP',
        image: '/images/products/valorant.png',
        images: [],
        category: 'game-topup',
        price: 1050,
        on_sale: true,
        sale_price: 840,
        delivery_type: 'instant',
        delivery_info: 'VP added via ID within 30 minutes',
        short_description: '1100 Valorant Points for weapon skins.',
        badge: '🎮 Gaming',
        featured: true,
        bestseller: true,
        new_arrival: false,
        in_stock: true,
        display_order: 6.5,
    },
    {
        slug: 'free-fire-diamonds',
        title: 'Free Fire Diamonds',
        image: '/images/products/freefire.png',
        images: [],
        category: 'game-topup',
        price: 120,
        on_sale: false,
        variants: [
            { label: '100 Diamonds',  price: 120 },
            { label: '310 Diamonds',  price: 350 },
            { label: '520 Diamonds',  price: 590 },
            { label: '1060 Diamonds', price: 1150 },
            { label: '2180 Diamonds', price: 2300 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Diamonds added within 30 minutes',
        short_description: 'Official Free Fire diamonds top-up.',
        badge: '🎮 Game',
        featured: false,
        bestseller: true,
        new_arrival: false,
        in_stock: true,
        display_order: 7,
    },

    // ── SOFTWARE ──
    {
        slug: 'windows-11-pro',
        title: 'Windows 11 Pro Key',
        image: '/images/products/windows.png',
        images: [],
        category: 'software',
        price: 550,
        on_sale: false,
        variants: [
            { label: 'Lifetime Key (1 PC)', price: 550 },
        ],
        delivery_type: 'manual',
        delivery_info: 'License key delivered via email within 12 hours',
        short_description: 'Genuine Windows 11 Pro activation key.',
        badge: '💻 Software',
        featured: false,
        bestseller: false,
        new_arrival: false,
        in_stock: true,
        display_order: 8,
    },
    {
        slug: 'microsoft-365',
        title: 'Microsoft 365 Personal',
        image: '/images/products/office365.png',
        images: [],
        category: 'software',
        price: 890,
        on_sale: false,
        variants: [
            { label: '1 Year', price: 890 },
        ],
        delivery_type: 'manual',
        delivery_info: 'Account access within 12 hours',
        short_description: 'Word, Excel, PowerPoint, 1TB OneDrive.',
        badge: '💼 Office',
        featured: false,
        bestseller: false,
        new_arrival: false,
        in_stock: true,
        display_order: 9,
    },
];

async function seedProducts() {
    console.log(`\n🌱 Seeding ${products.length} digital products to Firestore...\n`);

    for (const product of products) {
        const ref = db.collection('products').doc(product.slug);
        await ref.set({
            ...product,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`  ✅ ${product.title} (${product.category}) → products/${product.slug}`);
    }

    console.log('\n✨ Seeding complete!');
    console.log('   Firestore is now the single source of truth for the store.');
    console.log('   Admin panel → Products tab → Add/Edit any product live.\n');
    process.exit(0);
}

seedProducts().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
