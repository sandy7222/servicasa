import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { resolveTheme, toggleTheme, THEME_CHANGE_EVENT, type Theme } from '../../lib/theme';

type Variant = 'bar' | 'page';

const VARIANT_CLASS: Record<Variant, string> = {
  bar: 'text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700',
  page: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 dark:border-slate-700',
};

export const ThemeToggle: React.FC<{
  variant?: Variant;
  className?: string;
}> = ({ variant = 'page', className = '' }) => {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : resolveTheme()
  );

  useEffect(() => {
    const sync = () => setTheme(resolveTheme());
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${VARIANT_CLASS[variant]} ${className}`}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
