import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  PlusSquare,
  FileBarChart,
  FileText,
  BarChart3,
  Settings,
  Scan,
  Crosshair,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Target,
} from "lucide-react";

const primaryNavItems = [
  { to: "/", label: "Patient Dashboard", icon: LayoutDashboard },
  { to: "/new-session", label: "New Patient Intake", icon: PlusSquare },
  { to: "/calibration", label: "Gaze Calibration", icon: Crosshair },
  { to: "/assessment", label: "Assessment Hub", icon: Target },
  { to: "/reports", label: "Combined Reports", icon: FileText },
];

const advancedResearchItems = [
  { to: "/pilot-study", label: "Pilot Study Protocol", icon: Users },
  { to: "/pilot-report", label: "Pilot Study Report", icon: FileBarChart },
  { to: "/research-dashboard", label: "Cohort Dataset Manager", icon: BarChart3 },
  { to: "/webcam-test", label: "Webcam Diagnostics", icon: Scan },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <aside className="flex h-full w-64 flex-col bg-eyecog-navy text-slate-300">
      {/* Brand Header */}
      <div className="px-6 py-6 border-b border-eyecog-navy-light/40">
        <div className="text-base font-extrabold tracking-wider text-white">VISIONEXIS</div>
        <div className="text-[10px] uppercase font-semibold tracking-wider text-eyecog-teal">
          Gaze &amp; Motor Analytics
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4 overflow-y-auto">
        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Demonstration Flow
        </div>

        {primaryNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-eyecog-navy-light text-white font-semibold"
                  : "text-slate-400 hover:bg-eyecog-navy-light/60 hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 text-eyecog-teal shrink-0" />
            {label}
          </NavLink>
        ))}

        {/* Collapsible Advanced Research Tools */}
        <div className="pt-4 border-t border-eyecog-navy-light/40 mt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <div className="flex items-center gap-1.5 uppercase tracking-wider">
              <FlaskConical className="h-3.5 w-3.5 text-slate-500" />
              Researcher Tools
            </div>
            {showAdvanced ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-1 flex flex-col gap-1 pl-1">
              {advancedResearchItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-eyecog-navy-light text-white"
                        : "text-slate-400 hover:bg-eyecog-navy-light/50 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer Info */}
      <div className="border-t border-eyecog-navy-light/60 px-6 py-4 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-300">VISIONEXIS Prototype</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Assessment Protocol v2.0</p>
      </div>
    </aside>
  );
}
