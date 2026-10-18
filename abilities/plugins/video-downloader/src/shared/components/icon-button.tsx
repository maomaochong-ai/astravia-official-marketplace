import type { ReactNode } from "react";

interface IconButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children?: ReactNode;
}

export function IconButton({ icon, label, onClick, disabled = false, danger = false, children }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[11px] transition-colors disabled:opacity-40 ${
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <span className={`${icon} size-3.5`} aria-hidden="true" />
      {children}
    </button>
  );
}
