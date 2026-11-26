import { useState } from 'react';
import { Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import {
  groupedNavItems,
  sortedGroupKeys,
  categoryDisplayNames,
} from '../../lib/docs';

import SearchBar from '../SearchBar/SearchBar';
import './DocsSidebar.css';

function SidebarGroup({
  groupKey,
  items,
  onNavClick,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const label =
    categoryDisplayNames[groupKey] ||
    groupKey.replace(/-/g, ' ').toUpperCase();

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
      <button
        className="docs-burger"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} strokeWidth={2} />
      </button>

      <aside className={`docs-sidebar${open ? ' sidebar--open' : ''}`}>

        <button
          className="sidebar-close"
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

        <SearchBar onNavigate={closeDrawer} />

        <div className="sidebar-divider" />

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

      {open && (
        <div
          className="sidebar-backdrop"
          onClick={closeDrawer}
        />
      )}
    </>
  );
}