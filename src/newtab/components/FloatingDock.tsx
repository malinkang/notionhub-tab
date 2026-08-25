import React from "react"
import {
  Home,
  PenLine,
  Clapperboard,
  Library,
  Flame,
  Sparkles
} from "lucide-react"
import {
  DOCK_AVAILABLE_MODULES,
  type DockModuleId,
  type NewTabSettings
} from "../lib/settingsStore"

interface FloatingDockProps {
  activeModule: DockModuleId
  onSelectModule: (id: DockModuleId) => void
  settings: NewTabSettings
}

const MODULE_ICONS: Record<DockModuleId, React.ReactNode> = {
  home: <Home size={18} strokeWidth={2.2} />,
  memos: <PenLine size={18} strokeWidth={2.2} />,
  movies: <Clapperboard size={18} strokeWidth={2.2} />,
  books: <Library size={18} strokeWidth={2.2} />,
  sports: <Flame size={18} strokeWidth={2.2} />
}

export default function FloatingDock({
  activeModule,
  onSelectModule,
  settings
}: FloatingDockProps) {
  if (!settings.showDock) return null

  const rawEnabledIds = settings.enabledDockModules || [
    "home",
    "memos",
    "movies",
    "books",
    "sports"
  ]

  // 保证 home 始终固定在第一项，其余按用户自定义顺序排列
  const enabledIds = [
    "home",
    ...rawEnabledIds.filter((id) => id !== "home")
  ] as DockModuleId[]

  const visibleModules = enabledIds
    .map((id) => DOCK_AVAILABLE_MODULES.find((m) => m.id === id))
    .filter(Boolean) as typeof DOCK_AVAILABLE_MODULES

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none animate-in fade-in slide-in-from-bottom-4 duration-500"
      aria-label="快捷导航栏">
      <div className="flex items-center gap-1 sm:gap-1.5 px-3 py-2 rounded-full bg-white/75 dark:bg-stone-900/75 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] transition-all">
        {visibleModules.map((item) => {
          const isActive = activeModule === item.id
          const customLabel = settings.dockCustomLabels?.[item.id] || item.name

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              className={`group relative flex flex-col items-center justify-center min-w-[52px] sm:min-w-[58px] h-[48px] px-2 rounded-2xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-black/10 dark:bg-white/15 text-primary-content font-medium scale-100 shadow-sm"
                  : "text-base-content/70 hover:text-base-content hover:bg-black/5 dark:hover:bg-white/5 hover:-translate-y-0.5"
              }`}
              title={`${customLabel} - ${item.description}`}>
              <div
                className={`transition-transform duration-200 ${
                  isActive
                    ? "scale-110 text-primary dark:text-amber-300"
                    : "group-hover:scale-110 text-base-content/75 group-hover:text-base-content"
                }`}>
                {MODULE_ICONS[item.id] || <Sparkles size={18} />}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight transition-colors ${
                  isActive
                    ? "text-base-content font-semibold"
                    : "text-base-content/60 group-hover:text-base-content"
                }`}>
                {customLabel}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
