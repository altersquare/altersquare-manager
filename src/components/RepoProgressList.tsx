"use client";

import { CheckIcon, MailIcon, XIcon } from "@/components/icons";
import { CheckSquare, Spinner } from "@/components/ui";

export type RepoStatus = "pending" | "working" | "done" | "invited" | "failed";

export interface RepoProgress {
  repo: string;
  status: RepoStatus;
  error?: string;
}

const rowTone: Record<RepoStatus, string> = {
  pending: "bg-gray-800/60 text-gray-400",
  working: "bg-blue-500/5 text-gray-200",
  done: "bg-emerald-500/10 text-emerald-300",
  invited: "bg-blue-500/10 text-blue-300",
  failed: "bg-red-500/10 text-red-300",
};

export function RepoProgressList({
  items,
  labels,
}: {
  items: RepoProgress[];
  labels: Partial<Record<RepoStatus, string>>;
}) {
  const completed = items.filter((p) => p.status !== "pending" && p.status !== "working").length;
  return (
    <div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="max-h-64 overflow-y-auto space-y-1">
        {items.map((item) => (
          <li
            key={item.repo}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${rowTone[item.status]}`}
          >
            {item.status === "working" ? (
              <Spinner className="w-4 h-4 text-blue-400" />
            ) : item.status === "done" ? (
              <CheckIcon className="w-4 h-4 text-emerald-400" />
            ) : item.status === "invited" ? (
              <MailIcon className="w-4 h-4 text-blue-400" />
            ) : item.status === "failed" ? (
              <XIcon className="w-4 h-4 text-red-400" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-gray-600" />
            )}
            <span className="flex-1 truncate">{item.repo}</span>
            {labels[item.status] && (
              <span className="text-xs opacity-80" title={item.error}>
                {item.status === "failed" && item.error ? item.error : labels[item.status]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Checkbox row used by the add/remove pickers. */
export function RepoCheckRow({
  repo,
  checked,
  onToggle,
  tone = "blue",
  disabled = false,
  note,
}: {
  repo: string;
  checked: boolean;
  onToggle: () => void;
  tone?: "blue" | "red";
  disabled?: boolean;
  note?: string;
}) {
  const active = tone === "red" ? "bg-red-500/10 hover:bg-red-500/15" : "bg-blue-500/10 hover:bg-blue-500/15";
  return (
    <label
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        disabled
          ? "bg-gray-800/30 text-gray-600 cursor-not-allowed"
          : checked
            ? `${active} cursor-pointer text-gray-100`
            : "bg-gray-800/60 hover:bg-gray-800 cursor-pointer text-gray-400"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} className="sr-only" />
      {disabled ? <span className="w-4 h-4 shrink-0" /> : <CheckSquare checked={checked} tone={tone} />}
      <span className="flex-1 truncate">{repo}</span>
      {note && <span className="text-xs text-gray-500">{note}</span>}
    </label>
  );
}
