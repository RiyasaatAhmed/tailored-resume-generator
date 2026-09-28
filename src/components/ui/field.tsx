import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Editor field primitives, sharing the underline-only treatment from
 * `TextInput`: transparent fill, a single hairline rule beneath, square
 * corners, monospace uppercase label above.
 */

const baseField = [
  "type-body-md w-full rounded-none border-0 border-b bg-transparent",
  "px-0 py-2 text-on-dark outline-none",
  "border-b-hairline-strong focus:border-b-on-dark",
  "placeholder:text-muted-soft",
  "disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

export function Field({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="type-caption text-muted">
        {label}
      </label>
      <input id={id} {...props} className={`${baseField} ${className}`} />
    </div>
  );
}

export function TextareaField({
  label,
  id,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="type-caption text-muted">
        {label}
      </label>
      <textarea
        id={id}
        {...props}
        className={`${baseField} resize-y ${className}`}
      />
    </div>
  );
}

/** Section heading — display face, uppercase, wide-tracked, hairline beneath. */
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="type-title-sm border-b border-hairline pb-2 text-on-dark uppercase">
      {children}
    </h2>
  );
}
