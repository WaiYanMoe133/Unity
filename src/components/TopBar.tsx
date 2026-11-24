import {Menu} from 'lucide-react';
import type {NavSection} from '../types/workforce';
import {PWAInstallButton} from './PWAInstallButton';

interface TopBarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onNewTask: () => void;
  killSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  workspace: 'Task Workspace',
  agents: 'Agent Activity',
  monitor: 'Execution Monitor',
  connectors: 'Connectors & MCP',
  permissions: 'Permissions & Vault',
  models: 'Models & Memory',
  blueprint: 'Blueprint v2.0',
};

export function TopBar({
  activeSection,
  onSelectSection,
  onNewTask,
  killSwitchActive,
  onToggleKillSwitch,
  onOpenMobileMenu,
}: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-slate-800/80 bg-[#090D16] px-4 sm:px-6">
      {/* Zone 1: Single-line Brand / Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="font-display text-sm font-semibold text-slate-100 whitespace-nowrap shrink-0">
          Moe Workforce
        </span>
        <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
          /
        </span>
        <span className="text-sm text-slate-400 whitespace-nowrap truncate hidden sm:inline">
          {SECTION_TITLES[activeSection]}
        </span>
      </div>

      {/* Zone 2: 4 concise single-line text nav links */}
      <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-slate-400">
        <button
          type="button"
          onClick={() => onSelectSection('workspace')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 ${
            activeSection === 'workspace' ? 'text-slate-100 underline underline-offset-8 decoration-sky-400' : ''
          }`}
        >
          Workspace
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('monitor')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 ${
            activeSection === 'monitor' ? 'text-slate-100 underline underline-offset-8 decoration-sky-400' : ''
          }`}
        >
          Execution
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('permissions')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 ${
            activeSection === 'permissions' ? 'text-slate-100 underline underline-offset-8 decoration-sky-400' : ''
          }`}
        >
          Governance
        </button>
        <button
          type="button"
          onClick={() => onSelectSection('blueprint')}
          className={`transition-colors whitespace-nowrap shrink-0 hover:text-slate-100 ${
            activeSection === 'blueprint' ? 'text-slate-100 underline underline-offset-8 decoration-sky-400' : ''
          }`}
        >
          Blueprint
        </button>
      </nav>

      {/* Zone 3: Install PWA & Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />
        {killSwitchActive ? (
          <button
            type="button"
            onClick={onToggleKillSwitch}
            className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/25 transition-colors whitespace-nowrap shrink-0"
          >
            Release Kill Switch
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewTask}
            className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            New Task
          </button>
        )}
      </div>
    </header>
  );
}
