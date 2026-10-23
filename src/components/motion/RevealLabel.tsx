import type { ReactNode } from "react";

/**
 * A button label that stays tucked away (icon-only button) and slides out when the button is
 * hovered, focused from the keyboard, or its menu is open. The button needs the `group` class.
 * The text stays available to screen readers either way.
 */
export default function RevealLabel({ children }: { children: ReactNode }) {
  return (
    <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:ml-2 group-hover:grid-cols-[1fr] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100 group-data-[popup-open]:ml-2 group-data-[popup-open]:grid-cols-[1fr] group-data-[popup-open]:opacity-100 motion-reduce:transition-none">
      <span className="overflow-hidden whitespace-nowrap">{children}</span>
    </span>
  );
}
