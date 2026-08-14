"use client";

export function ConfirmSubmit({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
