import React, { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('documind_theme') || 'dark';
  });

  const applyThemeToDOM = (t) => {
    const isSakura = t === 'sakura';
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);

    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.classList.toggle('theme-sakura', isSakura);
    }
    document.body.classList.toggle('theme-sakura', isSakura);
    document.documentElement.classList.toggle('theme-sakura', isSakura);
  };

  useEffect(() => {
    applyThemeToDOM(theme);
    localStorage.setItem('documind_theme', theme);
  }, [theme]);

  const toggleTheme = (newTheme, event) => {
    if (newTheme === theme) return;

    const x = event?.clientX ?? window.innerWidth * 0.5;
    const y = event?.clientY ?? window.innerHeight * 0.5;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || !document.startViewTransition) {
      applyThemeToDOM(newTheme);
      setTheme(newTheme);
      return;
    }

    // Modern View Transitions API with expanding circular clip-path (portfolio style)
    const transition = document.startViewTransition(() => {
      applyThemeToDOM(newTheme);
      setTheme(newTheme);
    });

    transition.ready.then(() => {
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  };

  return (
    <div className="neo-theme-switch theme-switch" role="group" aria-label="Theme switcher">
      <button
        type="button"
        id="themeDarkBtn"
        className={`neo-theme-btn theme-switch-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={(e) => toggleTheme('dark', e)}
        title="Switch to Dark Blueprint Theme"
      >
        <Moon size={12} className="theme-icon inline mr-1" />
        <span>Dark</span>
      </button>
      <button
        type="button"
        id="themeSakuraBtn"
        className={`neo-theme-btn theme-switch-btn ${theme === 'sakura' ? 'active' : ''}`}
        onClick={(e) => toggleTheme('sakura', e)}
        title="Switch to Sakura Light Theme"
      >
        <Sun size={12} className="theme-icon inline mr-1" />
        <span>Sakura</span>
      </button>
    </div>
  );
}
