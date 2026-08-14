export function Field({
  label,
  name,
  required,
  placeholder,
  type = "text",
  as,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  as?: "textarea";
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose"> *</span>}
      </span>
      {as === "textarea" ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          rows={2}
          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand resize-none"
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
      )}
    </label>
  );
}
