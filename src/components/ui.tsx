"use client";

import { useEffect, useId } from "react";
import { CheckIcon, SearchIcon, WarningIcon, XIcon } from "@/components/icons";

// ── Buttons ─────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "ghost-danger";
type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700",
  danger: "bg-red-600 hover:bg-red-500 text-white",
  ghost: "text-gray-400 hover:text-gray-100 hover:bg-gray-800",
  "ghost-danger": "text-red-400 hover:text-red-300 hover:bg-red-500/10",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Form controls ───────────────────────────────────────────────────

export const inputClass =
  "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export function SearchInput({
  value,
  onChange,
  placeholder,
  list,
  className = "",
  autoFocus,
  icon,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  list?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
        {icon ?? <SearchIcon className="w-4 h-4" />}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className={`${inputClass} pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300 cursor-pointer"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

/** Visual checkbox square (pair with an sr-only native input). */
export function CheckSquare({
  checked,
  indeterminate = false,
  tone = "blue",
}: {
  checked: boolean;
  indeterminate?: boolean;
  tone?: "blue" | "red";
}) {
  const on = tone === "red" ? "bg-red-600 border-red-600" : "bg-blue-600 border-blue-600";
  return (
    <span
      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked ? on : "border-gray-600 bg-transparent"
      }`}
    >
      {checked && <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />}
      {!checked && indeterminate && <span className="w-2 h-0.5 bg-gray-400 rounded" />}
    </span>
  );
}

// ── Modal ───────────────────────────────────────────────────────────

const toneClasses = {
  blue: "bg-blue-500/10 text-blue-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  green: "bg-emerald-500/10 text-emerald-400",
};

/**
 * Shared dialog shell: backdrop, Esc / backdrop-click to close (unless busy),
 * close button, and a consistent header. Put actions in `footer`.
 */
export function Modal({
  title,
  subtitle,
  icon,
  tone = "blue",
  busy = false,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: keyof typeof toneClasses;
  busy?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!busy ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[calc(100vh-2rem)]"
      >
        <div className="flex items-start gap-3 p-5 pb-4">
          {icon && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id={titleId} className="text-base font-semibold text-gray-100">
              {title}
            </h3>
            {subtitle && <div className="text-sm text-gray-400 mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1 -m-1 text-gray-500 hover:text-gray-200 rounded-md transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        {children && <div className="px-5 overflow-y-auto">{children}</div>}
        {footer && <div className="flex justify-end gap-2 p-5 pt-4">{footer}</div>}
      </div>
    </div>
  );
}

// ── Page building blocks ────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold truncate">{title}</h1>
        {subtitle && <div className="text-gray-400 text-sm mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`text-center rounded-xl border border-dashed border-gray-800 ${
        compact ? "py-8 px-4" : "py-16 px-4"
      }`}
    >
      {icon && <div className="w-10 h-10 mx-auto text-gray-600 mb-3 [&>svg]:w-full [&>svg]:h-full">{icon}</div>}
      <p className="text-gray-300 font-medium text-sm">{title}</p>
      {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 flex items-start gap-3">
      <WarningIcon className="w-5 h-5 text-red-400 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="text-red-300">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 text-red-400 hover:text-red-300 underline cursor-pointer"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-gray-800/50 rounded-xl p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-gray-700 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-gray-700 rounded" />
            <div className="h-3 w-32 bg-gray-700/60 rounded" />
          </div>
          <div className="h-7 w-16 bg-gray-700 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function CountBadge({
  count,
  tone = "gray",
}: {
  count: number;
  tone?: "gray" | "amber" | "blue";
}) {
  const tones = {
    gray: "bg-gray-700/60 text-gray-300",
    amber: "bg-amber-500/15 text-amber-400",
    blue: "bg-blue-500/20 text-blue-300",
  };
  return (
    <span className={`inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${tones[tone]}`}>
      {count}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number; badge?: React.ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              isActive ? "text-gray-100" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && <CountBadge count={tab.count} tone={isActive ? "blue" : "gray"} />}
            {tab.badge}
            {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}
