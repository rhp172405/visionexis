import { useState, useEffect } from "react";
import {
  Key,
  ShieldCheck,
  LogOut,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  getOperatorToken,
  setOperatorToken,
  clearOperatorToken,
  verifyOperatorToken,
} from "@/lib/api";

export function OperatorAccessControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Initialize and check current token state
  useEffect(() => {
    const existing = getOperatorToken();
    setHasToken(!!existing && existing.length > 0);
  }, [isOpen]);

  const handleOpen = () => {
    setStatus("idle");
    setStatusMessage(null);
    setKeyInput("");
    setIsOpen(true);
  };

  const handleClose = () => {
    setStatus("idle");
    setStatusMessage(null);
    setKeyInput("");
    setIsOpen(false);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setStatus("error");
      setStatusMessage("Please enter an Operator API Key.");
      return;
    }

    setStatus("verifying");
    setStatusMessage(null);

    try {
      const result = await verifyOperatorToken(keyInput.trim());
      if (result.success) {
        setOperatorToken(keyInput.trim());
        setHasToken(true);
        setStatus("success");
        setStatusMessage("Operator authenticated successfully.");
        setKeyInput("");
        setTimeout(() => {
          setIsOpen(false);
          setStatus("idle");
          setStatusMessage(null);
        }, 1200);
      } else {
        setStatus("error");
        setStatusMessage(result.error || "Authentication failed. Invalid Operator Key.");
      }
    } catch {
      setStatus("error");
      setStatusMessage("Network error: Unable to verify Operator Key with server.");
    }
  };

  const handleSignOut = () => {
    clearOperatorToken();
    setHasToken(false);
    setStatus("idle");
    setStatusMessage("Operator key cleared from this session.");
    setKeyInput("");
    setTimeout(() => {
      setIsOpen(false);
      setStatus("idle");
      setStatusMessage(null);
    }, 800);
  };

  return (
    <>
      {/* Sidebar Compact Control */}
      <div className="px-3 py-2 border-t border-eyecog-navy-light/40 mt-1">
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-eyecog-navy-light/40 hover:bg-eyecog-navy-light/80 text-left transition text-xs"
          title="Clinical Operator & Examiner Access Control"
        >
          <div className="flex items-center gap-2">
            {hasToken ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <Key className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            <div className="truncate">
              <div className="font-semibold text-slate-200 text-[11px] leading-tight">
                {hasToken ? "Operator Active" : "Operator Access"}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {hasToken ? "Workstation Authenticated" : "Click to authenticate"}
              </div>
            </div>
          </div>
          <span
            className={`inline-block h-2 w-2 rounded-full shrink-0 ${
              hasToken ? "bg-emerald-400 ring-2 ring-emerald-400/20" : "bg-slate-500"
            }`}
          />
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-eyecog-navy border border-eyecog-teal/30">
                  <Key className="h-4 w-4 text-eyecog-teal" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Examiner / Operator Access</h3>
                  <p className="text-[11px] text-slate-400">Secure Study Workstation Authentication</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter the clinical <strong>Operator API Key</strong> to authenticate this browser session
                for participant registration and study administration. The key is stored only in
                ephemeral session memory and never bundled into client source code.
              </p>

              {/* Status Banner */}
              {hasToken && status !== "error" && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-3.5 py-2.5 text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Active Operator Session Connected</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 hover:text-white underline ml-2"
                  >
                    <LogOut className="h-3 w-3" />
                    Sign Out
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="flex items-start gap-2.5 rounded-lg bg-red-950/40 border border-red-800/60 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {status === "success" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-800/60 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleConnect} className="space-y-3.5">
                <div>
                  <label htmlFor="operator-key-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Operator API Key
                  </label>
                  <input
                    id="operator-key-input"
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={hasToken ? "Enter new key to update..." : "Paste operator key..."}
                    disabled={status === "verifying"}
                    autoComplete="off"
                    spellCheck="false"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-eyecog-teal focus:outline-none focus:ring-1 focus:ring-eyecog-teal disabled:opacity-50 font-mono"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Stored in <code>sessionStorage</code> under <code>visionexis-operator-token</code>.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={status === "verifying"}
                    className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  {hasToken && (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={status === "verifying"}
                      className="rounded-lg border border-red-800/50 bg-red-950/30 px-3.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 transition flex items-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Clear Key
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!keyInput.trim() || status === "verifying"}
                    className="rounded-lg bg-eyecog-teal px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                  >
                    {status === "verifying" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {hasToken ? "Update & Connect" : "Verify & Connect"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
