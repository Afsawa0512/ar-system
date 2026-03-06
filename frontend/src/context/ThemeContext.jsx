import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // 'light' | 'dark' | 'system'
    const [mode, setMode] = useState(localStorage.getItem('themeMode') || 'system');

    const getResolvedTheme = useCallback((m) => {
        if (m === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return m;
    }, []);

    const [theme, setTheme] = useState(getResolvedTheme(mode));

    useEffect(() => {
        const resolved = getResolvedTheme(mode);
        setTheme(resolved);
        const root = window.document.documentElement;
        if (resolved === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('themeMode', mode);
    }, [mode, getResolvedTheme]);

    // Listen for system theme changes when mode is 'system'
    useEffect(() => {
        if (mode !== 'system') return;
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            const resolved = e.matches ? 'dark' : 'light';
            setTheme(resolved);
            const root = window.document.documentElement;
            if (resolved === 'dark') root.classList.add('dark');
            else root.classList.remove('dark');
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [mode]);

    const setThemeMode = (newMode) => {
        setMode(newMode);
    };

    // Backward compat
    const toggleTheme = () => {
        setMode(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'system';
            return 'light';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, mode, setThemeMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
