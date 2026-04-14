import { persistentAtom, persistentMap } from '@nanostores/persistent';

interface CartItem {
    id: string; // Product slug + variant label hash
    productId: string;
    productTitle: string;
    productImage: string;
    variantLabel: string | null;
    price: number;
    quantity: number;
}

interface WishlistItem {
    id: string;
    title: string;
    image: string;
    price: number;
}

// Persisted across page loads in localStorage
export const cartItems = persistentAtom<CartItem[]>('arczen_cart', [], {
    encode: JSON.stringify,
    decode: JSON.parse
});

export const wishlistItems = persistentAtom<WishlistItem[]>('arczen_wishlist', [], {
    encode: JSON.stringify,
    decode: JSON.parse
});

// UI state for the drawer
export const isCartOpen = persistentAtom<boolean>('arczen_cart_open', false, {
    encode: (val) => val ? 'true' : 'false',
    decode: (val) => val === 'true'
});

export const isProductModalOpen = persistentAtom<boolean>('arczen_modal_open', false, {
    encode: (val) => val ? 'true' : 'false',
    decode: (val) => val === 'true'
});

export const activeProduct = persistentAtom<any>('arczen_active_product', null, {
    encode: JSON.stringify,
    decode: JSON.parse
});

// Cart functions
export function addToCart(item: Omit<CartItem, 'id'>) {
    const current = cartItems.get();
    const id = `${item.productId}-${item.variantLabel || 'base'}`;
    
    const existingIndex = current.findIndex(i => i.id === id);
    if (existingIndex >= 0) {
        const newItems = [...current];
        newItems[existingIndex].quantity += item.quantity;
        cartItems.set(newItems);
    } else {
        cartItems.set([...current, { ...item, id }]);
    }
    
    isCartOpen.set(true); // Auto open cart on add
}

export function updateQuantity(id: string, newQty: number) {
    if (newQty <= 0) {
        removeFromCart(id);
        return;
    }
    const current = cartItems.get();
    const index = current.findIndex(i => i.id === id);
    if (index >= 0) {
        const newItems = [...current];
        newItems[index].quantity = newQty;
        cartItems.set(newItems);
    }
}

export function removeFromCart(id: string) {
    cartItems.set(cartItems.get().filter(i => i.id !== id));
}

export function clearCart() {
    cartItems.set([]);
}

// Removes only the items that were just ordered (by their id list), leaving others in cart
export function removeOrderedItems(orderedIds: string[]) {
    const idSet = new Set(orderedIds);
    cartItems.set(cartItems.get().filter(i => !idSet.has(i.id)));
}

export function openProductModal(product: any) {
    activeProduct.set(product);
    isProductModalOpen.set(true);
}

export function closeProductModal() {
    isProductModalOpen.set(false);
    setTimeout(() => activeProduct.set(null), 300); // clear after animation
}

// Wishlist functions
export function toggleWishlist(item: WishlistItem) {
    const current = wishlistItems.get();
    const exists = current.some(i => i.id === item.id);
    
    if (exists) {
        wishlistItems.set(current.filter(i => i.id !== item.id));
    } else {
        wishlistItems.set([...current, item]);
    }
}

export function clearWishlist() {
    wishlistItems.set([]);
}
