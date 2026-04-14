/**
 * Seed Script — Populate Firestore with REAL premium product catalog (NO PERFUME)
 * ─────────────────────────────────────────────────────────────
 * Run: node scripts/seed-real-products.js
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

const serviceAccountPath = resolve(__dirname, '../service-account.json');
let credential;
try {
    const sa = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    credential = cert(sa);
} catch {
    credential = cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    });
}

initializeApp({ credential });
const db = getFirestore();

const products = [
    // ── SUBSCRIPTIONS ──
    {
        slug: 'netflix-premium-4k',
        title: 'Netflix Premium (4K + HDR)',
        image: '/images/products/netflix.png',
        category: 'subscription',
        price: 320,
        short_description: 'Unlimited movies, TV shows, and more on your favorite devices.',
        badge: '🎬 4K UHD',
        featured: true,
        type: 'digital',
        variants: [
            { label: '1 Month (Private)', price: 320 },
            { label: '3 Months (Private)', price: 900 },
            { label: 'Screen Share (1 Month)', price: 150 }
        ]
    },
    {
        slug: 'chatgpt-plus-subscription',
        title: 'ChatGPT Plus (GPT-4o)',
        image: '/images/products/chatgpt.png',
        category: 'subscription',
        price: 650,
        short_description: 'Access GPT-4o, DALL·E, and advanced data analysis.',
        badge: '🤖 AI Power',
        featured: true,
        type: 'digital',
        variants: [
            { label: '1 Month', price: 650 },
            { label: '3 Months', price: 1850 }
        ]
    },
    {
        slug: 'spotify-premium-individual',
        title: 'Spotify Premium Individual',
        image: '/images/products/spotify.png',
        category: 'subscription',
        price: 180,
        short_description: 'Ad-free music, offline listening, and high-quality audio.',
        badge: '🎵 Music',
        featured: false,
        type: 'digital',
        variants: [
            { label: '1 Month', price: 180 },
            { label: '6 Months', price: 950 },
            { label: '1 Year', price: 1800 }
        ]
    },
    {
        slug: 'adobe-creative-cloud-all-apps',
        title: 'Adobe Creative Cloud (Full)',
        image: '/images/products/adobe.png',
        category: 'subscription',
        price: 1200,
        short_description: '20+ creative apps including Photoshop, Premiere, and Illustrator.',
        badge: '🎨 Pro',
        featured: true,
        type: 'digital',
        variants: [
            { label: '1 Month', price: 1200 },
            { label: '1 Year (Student)', price: 8500 }
        ]
    },

    // ── SOFTWARE ──
    {
        slug: 'windows-11-pro-license',
        title: 'Windows 11 Pro (Lifetime)',
        image: '/images/products/windows.png',
        category: 'software',
        price: 550,
        short_description: 'Genuine activation key for Windows 11 Professional. Lifetime support.',
        badge: '💼 Original',
        featured: false,
        type: 'digital',
        variants: [
            { label: 'Retail Key', price: 550 },
            { label: 'OEM Key', price: 350 }
        ]
    },

    // ── IMS SERVICES ──
    {
        slug: 'enterprise-ecommerce-engine',
        title: 'ArcZen E-commerce Engine',
        image: '/images/products/ims-store.png',
        category: 'service',
        price: 65000,
        short_description: 'Complete e-commerce infrastructure with Zero-Trust security and Admin Panel.',
        badge: '⚡ Enterprise',
        featured: true,
        type: 'service',
        variants: [
            { label: 'Basic Setup', price: 65000 },
            { label: 'Custom Enterprise', price: 125000 }
        ]
    }
];

async function seedRealProducts() {
    console.log(`\n🌱 Seeding REAL products to Firestore (NO PERFUME)...\n`);

    // CLEANUP: Delete perfume remnants if they exist
    const oldPerfumes = ['aura-noir-eau-de-parfum', 'zenith-rose-perfume', 'midnight-oud-intense'];
    for (const slug of oldPerfumes) {
        await db.collection('products').doc(slug).delete();
        console.log(`  🗑️ Removed old perfume entry: ${slug}`);
    }

    for (const product of products) {
        const ref = db.collection('products').doc(product.slug);
        await ref.set({
            ...product,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        console.log(`  ✅ ${product.title} → products/${product.slug}`);
    }

    console.log('\n✨ Strictly digital products seeded successfully!');
    process.exit(0);
}

seedRealProducts().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
