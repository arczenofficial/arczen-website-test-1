import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
    output: 'static', // Astro v5: static allows per-page SSR toggling; hybrid is removed.
    adapter: netlify(),
    
    // Static generation — products from .md files, auth client-side via Firebase JS SDK
    integrations: [tailwind()],
    publicDir: './public',

    vite: {
        ssr: {
            noExternal: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage']
        }
    }
});
