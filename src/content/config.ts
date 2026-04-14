import { z, defineCollection } from 'astro:content';

const productsCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        image: z.string().optional(),
        gallery: z.array(z.string()).optional(),
        category: z.enum(['subscription', 'game-topup', 'software', 'service', 'other']),
        productId: z.string(),
        short_description: z.string().optional(),
        
        price: z.number().int().positive(),
        
        variants: z.array(z.object({
            label: z.string(),
            price: z.number().int().positive(),
            sale_price: z.number().int().positive().optional()
        })).optional(),

        on_sale: z.boolean().default(false),
        sale_price: z.number().int().positive().optional(),
        offer_label: z.string().optional(),
        offer_expires: z.date().optional(),

        badge: z.string().optional(),
        featured: z.boolean().default(false),
        new_arrival: z.boolean().default(false),
        bestseller: z.boolean().default(false),

        delivery_type: z.enum(['instant', 'manual']).default('manual'),
        delivery_time: z.string().optional(),
        
        trust_score: z.number().int().min(0).max(100).default(98),
        reviews_count: z.number().int().default(0),

        // ─── Availability ─────────────────────────────
        in_stock: z.boolean().default(true),
        stock_label: z.string().optional(),
        quick_add: z.boolean().default(true),

        // ─── Display ──────────────────────────────────
        display_order: z.number().default(50),
    }),
});

export const collections = {
    'products': productsCollection
};
