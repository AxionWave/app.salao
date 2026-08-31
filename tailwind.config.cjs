/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                accent: {
                    DEFAULT: '#7c3aed',
                    hover: '#6d28d9',
                    muted: '#ede9fe',
                },
            },
            fontFamily: {
                sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [require('@tailwindcss/forms')({ strategy: 'class' })],
};
