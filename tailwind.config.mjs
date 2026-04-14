/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
                cream: 'rgb(var(--color-cream) / <alpha-value>)',
                muted: 'rgb(var(--color-muted) / <alpha-value>)',
                dark: '#0d0b08',
                light: '#f5f2eb',
                brand: {
                    gold: '#c6a75e',
                    'gold-light': '#e8c87a',
                    'gold-dark': '#a88b3d',
                    warm: '#0d0b08',
                    'warm-light': '#151210',
                    'warm-card': '#1a1714',
                },
            },
            fontFamily: {
                serif: ['Playfair Display', 'serif'],
                sans: ['Inter', 'sans-serif'],
            },
            backgroundImage: {
                'gradient-luxury': 'linear-gradient(135deg, #0d0b08 0%, #151210 50%, #0d0b08 100%)',
                'gradient-gold': 'linear-gradient(135deg, #c6a75e 0%, #e8c87a 50%, #c6a75e 100%)',
                'gradient-section': 'linear-gradient(180deg, rgba(198,167,94,0.03) 0%, transparent 30%, transparent 70%, rgba(198,167,94,0.02) 100%)',
            },
            boxShadow: {
                'gold': '0 4px 20px rgba(198,167,94,0.15)',
                'gold-lg': '0 8px 40px rgba(198,167,94,0.2)',
                'gold-glow': '0 0 30px rgba(198,167,94,0.15)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 3s ease-in-out infinite',
                'slide-up': 'slideUp 0.8s ease-out forwards',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                glow: {
                    '0%, 100%': { opacity: '0.4' },
                    '50%': { opacity: '0.8' },
                },
                slideUp: {
                    'from': { opacity: '0', transform: 'translateY(30px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
};
