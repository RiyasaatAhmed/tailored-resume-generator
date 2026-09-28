import type { ButtonHTMLAttributes } from "react";

/**
 * The signature CTA: transparent fill, 1px white outline, pill radius.
 *
 * design-system.md is emphatic that the transparent pill *is* the brand button
 * and that filling it reads as off-brand — every other luxury-auto site uses a
 * filled button. Label type is monospace, uppercase, 2.5px tracked. Buttons are
 * the only rounded element in the system.
 */
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "type-button inline-flex h-11 items-center justify-center rounded-[9999px]",
        "border border-on-dark bg-transparent px-8 text-on-dark",
        "transition-opacity",
        // Disabled is not in the source analysis — bugatti.com has almost no
        // forms. Dimming preserves the outline rather than introducing a fill.
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      ].join(" ")}
    />
  );
}
