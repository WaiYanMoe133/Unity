import {
  Activity,
  Bot,
  Cpu,
  Layers,
  Plug,
  ShieldCheck,
  TerminalSquare,
  X,
} from 'lucide-react';
import type {NavSection, OperatingMode} from '../types/workforce';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  operatingMode: OperatingMode;
  onChangeMode: (mode: OperatingMode) => void;
  usedRamMb: number;
  killSwitchActive: boolean;
  waitingApprovalCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_GROUPS: {
  label: string;
  items: {id: NavSection; label: string; icon: typeof TerminalSquare}[];
}[] = [
  {
    label: 'Workforce',
    items: [
      {id: 'workspace', label: 'Task Workspace', icon: TerminalSquare},
      {id: 'agents', label: 'Agent Activity', icon: Bot},
      {id: 'monitor', label: 'Execution Monitor', icon: Activity},
    ],
  },
  {
    label: 'Platform & Governance',
    items: [
      {id: 'connectors', label: 'Connectors & MCP', icon: Plug},
      {id: 'permissions', label: 'Permissions & Vault', icon: ShieldCheck},
      {id: 'models', label: 'Models & Memory', icon: Cpu},
    ],
  },
  {
    label: 'Architecture',
    items: [{id: 'blueprint', label: 'Blueprint v2.0', icon: Layers}],
  },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  operatingMode,
  onChangeMode,
  usedRamMb,
  killSwitchActive,
  waitingApprovalCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const budgetMb = 8192;
  const pct = Math.min(100, Math.round((usedRamMb / budgetMb) * 100));

  const content = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800/80 bg-[#0D1322] text-slate-200 select-none">
      <div className="flex h-14 items-center justify-between border-b border-slate-800/80 px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/10 text-xs font-semibold text-sky-400">
            M
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-slate-100 whitespace-nowrap truncate">
            Moe Desktop
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Operating Mode Switcher */}
      <div className="border-b border-slate-800/80 px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>Operating Mode</span>
          <span className="font-mono text-[11px] text-slate-300 capitalize">{operatingMode}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-[#090D16] p-1">
          {(['local', 'hybrid', 'cloud'] as OperatingMode[]).map((mode) => {
            const active = operatingMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeMode(mode)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-2.5 text-[11px] font-medium text-slate-500">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectSection(item.id);
                      onCloseMobile();
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-800/80 text-slate-50'
                        : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-sky-400' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'workspace' && waitingApprovalCount > 0 && (
                      <span className="font-mono text-[11px] text-amber-400 tabular-nums">
                        {waitingApprovalCount}
                      </span>
                    )}
                    {item.id === 'permissions' && killSwitchActive && (
                      <span className="font-mono text-[11px] text-red-400">HALT</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 8GB RAM Target Budget Summary */}
      <div className="border-t border-slate-800/80 px-4 py-3.5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-slate-400">8GB RAM Budget</span>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              usedRamMb > 6800 ? 'text-amber-400' : 'text-slate-300'
            }`}
          >
            {(usedRamMb / 1024).toFixed(1)} / 8.0 GB
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all duration-200 ${
              usedRamMb > 6800 ? 'bg-amber-500' : 'bg-sky-500'
            }`}
            style={{width: `${pct}%`}}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-snug">
          Local-first · Rust Core IPC · CPU-capable
        </p>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block lg:h-full">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
