import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lyra-theme';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function themeColor(theme: Theme) {
    return theme === 'dark' ? 'oklch(0.155 0.008 265)' : 'oklch(0.97 0.012 80)';
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof localStorage === 'undefined') return 'dark';
        const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (saved === 'light' || saved === 'dark') return saved;
        return 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
        localStorage.setItem(STORAGE_KEY, theme);
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme));
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeState }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
    }
    return context;
};
