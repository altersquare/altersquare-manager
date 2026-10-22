"use client";

import { useState } from "react";
import { Button, EmptyState, ErrorState, ListSkeleton, SearchInput } from "@/components/ui";
import { CheckIcon, CopyIcon, KeyIcon, PencilIcon, PlusIcon, TrashIcon, VariableIcon } from "@/components/icons";
import { formatDate, timeAgo } from "@/lib/format";
import type { EntryKind } from "@/components/EntryModal";

export interface Entry {
  name: string;
  value?: string; // variables only
  created_at: string;
  updated_at: string;
}

const SEARCH_THRESHOLD = 6;

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // Clipboard can be unavailable on insecure origins; nothing useful to do
    }
  };
  return { copied, copy };
}

function CopyButton({ copied, onClick, label }: { copied: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? "Copied!" : label}
      aria-label={label}
      className="p-1 text-gray-500 hover:text-gray-200 rounded transition-colors cursor-pointer"
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
    </button>
  );
}

/** List of secrets or variables with search, copy helpers and edit/delete actions. */
export function EntryList({
  kind,
  title,
  items,
  loading,
  error,
  onRetry,
  onAdd,
  onEdit,
  onDelete,
}: {
  kind: EntryKind;
  title?: string;
  items: Entry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (item: Entry) => void;
  /** Omit to hide delete (members can't delete). */
  onDelete?: (item: Entry) => void;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { copied, copy } = useCopy();
  const isSecret = kind === "secret";
  const noun = isSecret ? "secret" : "variable";
  const refPrefix = isSecret ? "secrets" : "vars";

  const q = search.toLowerCase();
  const filtered = items.filter(
    (i) => !q || i.name.toLowerCase().includes(q) || (!isSecret && i.value?.toLowerCase().includes(q))
  );

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        {title && (
          <h3 className="text-sm font-semibold text-gray-300 mr-auto">
            {title} <span className="text-gray-500 font-normal">({items.length})</span>
          </h3>
        )}
        {items.length > SEARCH_THRESHOLD && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Filter ${noun}s…`}
            className={title ? "w-48 sm:w-64" : "flex-1"}
          />
        )}
        {!title && items.length <= SEARCH_THRESHOLD && <div className="flex-1" />}
        <Button variant="primary" size="sm" onClick={onAdd} className="shrink-0">
          <PlusIcon className="w-3.5 h-3.5" />
          New {noun}
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={2} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={isSecret ? <KeyIcon /> : <VariableIcon />}
          title={`No ${noun}s yet`}
          description={
            isSecret
              ? "Secrets are encrypted values (API keys, tokens) your workflows read as ${{ secrets.NAME }}."
              : "Variables are plain-text config your workflows read as ${{ vars.NAME }}."
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No {noun}s match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
          {filtered.map((item) => {
            const isOpen = expanded.has(item.name);
            const value = item.value ?? "";
            const isLong = value.length > 80 || value.includes("\n");
            return (
              <li key={item.name} className="group flex items-start gap-3 px-4 py-3 bg-gray-900/40 hover:bg-gray-800/40">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isSecret ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {isSecret ? <KeyIcon className="w-4 h-4" /> : <VariableIcon className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-medium text-sm truncate">{item.name}</span>
                    <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <CopyButton
                        copied={copied === `ref:${item.name}`}
                        onClick={() => copy(`ref:${item.name}`, `\${{ ${refPrefix}.${item.name} }}`)}
                        label={`Copy \${{ ${refPrefix}.${item.name} }}`}
                      />
                    </span>
                  </div>

                  {!isSecret && (
                    <div className="flex items-start gap-1 mt-0.5">
                      {value ? (
                        <code
                          className={`text-xs text-gray-400 font-mono min-w-0 ${
                            isOpen ? "whitespace-pre-wrap break-all" : "truncate"
                          }`}
                        >
                          {value}
                        </code>
                      ) : (
                        <span className="text-xs italic text-gray-600">(empty)</span>
                      )}
                      {value && (
                        <CopyButton
                          copied={copied === `val:${item.name}`}
                          onClick={() => copy(`val:${item.name}`, value)}
                          label="Copy value"
                        />
                      )}
                      {isLong && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (isOpen) next.delete(item.name);
                              else next.add(item.name);
                              return next;
                            })
                          }
                          className="text-xs text-blue-400 hover:text-blue-300 shrink-0 cursor-pointer"
                        >
                          {isOpen ? "Less" : "More"}
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-500 mt-0.5" title={formatDate(item.updated_at)}>
                    Updated {timeAgo(item.updated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)} title={isSecret ? "Replace value" : "Edit value"}>
                    <PencilIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isSecret ? "Replace" : "Edit"}</span>
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      onClick={() => onDelete(item)}
                      title={`Delete ${noun}`}
                      aria-label={`Delete ${item.name}`}
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
