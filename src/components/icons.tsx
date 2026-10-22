// Shared outline icons (Heroicons paths). All accept a className for sizing/colour.

type IconProps = { className?: string; strokeWidth?: number };

function Outline({
  d,
  className = "w-4 h-4",
  strokeWidth = 2,
}: IconProps & { d: string | string[] }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
    >
      {(Array.isArray(d) ? d : [d]).map((path) => (
        <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />
      ))}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => <Outline {...p} d="M12 4v16m8-8H4" />;
export const XIcon = (p: IconProps) => <Outline {...p} d="M6 18L18 6M6 6l12 12" />;
export const CheckIcon = (p: IconProps) => <Outline {...p} d="M5 13l4 4L19 7" />;
export const SearchIcon = (p: IconProps) => (
  <Outline {...p} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
);
export const ChevronLeftIcon = (p: IconProps) => <Outline {...p} d="M15 19l-7-7 7-7" />;
export const ChevronRightIcon = (p: IconProps) => <Outline {...p} d="M9 5l7 7-7 7" />;
export const ChevronDownIcon = (p: IconProps) => <Outline {...p} d="M19 9l-7 7-7-7" />;
export const ExternalLinkIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
  />
);
export const RefreshIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
  />
);
export const KeyIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
  />
);
export const VariableIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
  />
);
export const ServerIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
  />
);
export const UsersIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
  />
);
export const UserPlusIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
  />
);
export const FolderIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
  />
);
export const WarningIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
  />
);
export const CopyIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
  />
);
export const PencilIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
  />
);
export const TrashIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
  />
);
export const MailIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
  />
);
export const LogoutIcon = (p: IconProps) => (
  <Outline
    {...p}
    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
  />
);
