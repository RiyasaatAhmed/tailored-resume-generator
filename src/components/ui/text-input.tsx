import type { InputHTMLAttributes } from "react";

/**
 * Underline-only input: transparent background, no top/left/right border, a
 * single hairline-strong rule underneath that thickens to white on focus.
 * Square corners — radius is reserved for buttons.
 *
 * The label sits above in caption type (monospace, uppercase, tracked) rather
 * than as a placeholder, so it survives being filled in.
 *
 * Error state is not in the source analysis; design-system.md records that gap.
 * Chosen here: the rule and the message both take `danger`, and the message is
 * wired with aria-describedby + aria-invalid so it is announced, not just seen.
 */
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextInput({
  label,
  error,
  id,
  className = "",
  ...props
}: TextInputProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-caption text-muted">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={[
          "type-body-md h-11 w-full rounded-none border-0 border-b bg-transparent",
          "px-0 py-3 text-on-dark outline-none",
          "placeholder:text-muted-soft",
          error
            ? "border-b-danger focus:border-b-danger"
            : "border-b-hairline-strong focus:border-b-on-dark",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className,
        ].join(" ")}
      />
      {error ? (
        <p id={errorId} className="type-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
