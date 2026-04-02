// src/components/SideBar/DocsSidebar.jsx
import { useState } from 'react';
import { Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { groupedNavItems, sortedGroupKeys, categoryDisplayNames } from '../../lib/docs';
import SearchBar from '../SearchBar/SearchBar';
import './DocsSidebar.css';

function SidebarGroup({ groupKey, items, onNavClick, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const label = categoryDisplayNames[groupKey] || groupKey.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="sidebar-group">
      <button
        className="sidebar-header"
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
        <nav>
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
  const [open, setOpen] = useState(false);

  const closeDrawer = () => setOpen(false);

  return (
    <>
      {/* ── Burger (mobile only) ─────────────────────────────── */}
      <button
        className="docs-burger"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} strokeWidth={2} />
      </button>

      {/* ── Sidebar / Drawer ────────────────────────────────── */}
      <aside className={`docs-sidebar${open ? ' sidebar--open' : ''}`}>

        {/* Close button (mobile) */}
        <button
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={closeDrawer}
        >
          <X size={20} strokeWidth={2} />
        </button>

        {/* Project name */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-name">Project David</span>
          <span className="sidebar-brand-tag">docs</span>
        </div>

        {/* Search */}
        <SearchBar onNavigate={closeDrawer} />

        {/* Divider */}
        <div className="sidebar-divider" />

        {/* Nav groups */}
        {sortedGroupKeys.map(groupKey => (
          <SidebarGroup
            key={groupKey}
            groupKey={groupKey}
            items={groupedNavItems[groupKey]}
            onNavClick={closeDrawer}
            defaultOpen={false}
          />
        ))}
      </aside>

      {/* Backdrop (mobile) */}
      {open && (
        <div className="sidebar-backdrop" onClick={closeDrawer} />
      )}
    </>
  );
}