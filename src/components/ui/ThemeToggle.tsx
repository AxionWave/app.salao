import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
    const { theme, toggleTheme } = useTheme();
    const irParaEscuro = theme === 'light';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lyra border transition-colors ${className}`}
            style={{
                borderColor: 'var(--lyra-border)',
                backgroundColor: 'var(--lyra-surface)',
                color: 'var(--lyra-text)',
            }}
            title={irParaEscuro ? 'Ativar modo escuro' : 'Ativar modo claro'}
            aria-label={irParaEscuro ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
            {irParaEscuro ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                    />
                </svg>
            ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
            )}
        </button>
    );
}
