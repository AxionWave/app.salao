/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                accent: {
                    DEFAULT: 'var(--copper)',
                    hover: 'var(--ember)',
                    muted: 'var(--lyra-accent-muted)',
                    foreground: 'var(--primary-foreground)',
                },
                canvas: 'var(--background)',
                surface: 'var(--card)',
                ink: 'var(--ink)',
                muted: 'var(--muted-foreground)',
                faint: 'var(--faint)',
                line: 'var(--line)',
                copper: 'var(--copper)',
                ember: 'var(--ember)',
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['Archivo', 'Inter', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                lyra: 'var(--radius)',
                'lyra-lg': 'calc(var(--radius) + 4px)',
            },
        },
    },
    plugins: [require('@tailwindcss/forms')({ strategy: 'class' })],
};
