import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { Link, NavLink, matchPath, useLocation } from 'react-router-dom';

import {
  getDocAudience,
  getNavigation,
  categoryDisplayNames,
} from '../../lib/docs';

import SearchBar from '../SearchBar/SearchBar';
import './DocsSidebar.css';

function SidebarGroup({
  groupKey,
  items,
  onNavClick,
}) {
  const { pathname } = useLocation();
  const containsActivePage = items.some(({ route }) =>
    matchPath({ path: route, end: true }, pathname)
  );
  const [open, setOpen] = useState(containsActivePage);
  const groupId = useId();

  useEffect(() => {
    if (containsActivePage) setOpen(true);
  }, [pathname, containsActivePage]);

  const label =
    categoryDisplayNames[groupKey] ||
    groupKey.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="sidebar-group">
      <button
        className="sidebar-header"
        type="button"
        aria-controls={open ? groupId : undefined}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{label}</span>

        {open
          ? <ChevronDown size={13} strokeWidth={2} />
          : <ChevronRight size={13} strokeWidth={2} />
        }
      </button>

      {open && (
        <nav id={groupId} aria-label={label}>
          {items.map(({ route, label }) => (
            <NavLink
              key={route}
              to={route}
              end
              onClick={onNavClick}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function DocsSidebar() {
  const [requestedOpen, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const open = mobile && requestedOpen;
  const { pathname } = useLocation();
  const match = matchPath({ path: '/docs/:slug', end: true }, pathname);
  const audience = getDocAudience(match?.params.slug);
  const navigation = getNavigation(audience);

  const drawerRef = useRef(null);
  const burgerRef = useRef(null);
  const closeRef = useRef(null);
  const closeDrawer = () => setOpen(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const resize = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    resize();
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const burger = burgerRef.current;
    const main = drawer.closest('.docs-layout')?.querySelector('.docs-main');
    const wasInert = main?.inert;
    if (main) main.inert = true;

    const focusable = () => [...drawer.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 &&
        !element.closest('[inert]') && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility === 'visible');

    closeRef.current?.focus();

    function handleKey(event) {
      // The search combobox consumes Escape before it reaches this handler.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        const outside = !drawer.contains(document.activeElement);
        if (event.shiftKey && (document.activeElement === first || outside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || outside)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function keepFocus(event) {
      if (!drawer.contains(event.target)) focusable()[0]?.focus();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', keepFocus);
      if (main) main.inert = wasInert;
      // Wait for React's close/resize commit to remove inert and update visibility.
      queueMicrotask(() => {
        if (!drawer.isConnected || drawer.classList.contains('sidebar--open')) return;
        if (burger?.isConnected && burger.getClientRects().length && !burger.inert) {
          burger.focus();
        } else if (drawer.contains(document.activeElement) || document.activeElement === document.body) {
          drawer.querySelector('.sidebar-brand')?.focus();
        }
      });
    };
  }, [open]);

  return (
    <>
      <button
        className="docs-burger"
        ref={burgerRef}
        type="button"
        inert={open}
        aria-controls="docs-navigation"
        tabIndex={open ? -1 : undefined}
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 9h18M3 15h11" />
        </svg>
      </button>

      <aside className={`docs-sidebar${open ? ' sidebar--open' : ''}`}
        ref={drawerRef} id="docs-navigation"
        inert={mobile && !open}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Documentation navigation">

        <button
          className="sidebar-close"
          ref={closeRef}
          type="button"
          aria-label="Close navigation"
          onClick={closeDrawer}
        >
          <X size={20} strokeWidth={2} />
        </button>

        <Link
          to="/docs"
          className="sidebar-brand"
          onClick={closeDrawer}
        >
          <img
            src="/projectdavid-emblem.svg"
            alt=""
            className="sidebar-brand-emblem"
            width={24}
            height={24}
          />

          <span className="sidebar-brand-name">
            Project David
          </span>
        </Link>

        <SearchBar
          key={audience}
          audience={audience}
          onNavigate={closeDrawer}
        />

        <div className="sidebar-divider" />

        {audience === 'contributing' && (
          <Link to="/docs" className="sidebar-link" onClick={closeDrawer}>
            ← Documentation
          </Link>
        )}

        {navigation.map(({ groupKey, items }) => (
          <SidebarGroup
            key={`${audience}:${groupKey}`}
            groupKey={groupKey}
            items={items}
            onNavClick={closeDrawer}
          />
        ))}

      </aside>

      {open && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}
    </>
  );
}
