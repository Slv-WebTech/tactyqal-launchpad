"use client";
import Link from "next/link";
import { useState } from "react";

/*
  Icon-first controls.
  - Tip:        hover/focus tooltip that follows WCAG 1.4.13 (dismissible with Esc, hoverable, persistent).
  - IconAction: an icon-only link or button. The accessible name is ALWAYS the `label` (aria-label), and the same text
                is shown in the tooltip, so sighted, keyboard and screen-reader users get the same information.
  Icons are passed as elements (e.g. icon={<Search />}) so server components can use them.
*/

const ALIGN = { center: "left-1/2 -translate-x-1/2", start: "left-0", end: "right-0" };
const SIDE = { bottom: "top-full pt-1.5", top: "bottom-full pb-1.5" };

export function Tip({ label, children, align = "center", side = "bottom", className = "" }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const show = (hover || focus) && !dismissed;
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDismissed(false); }}
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={() => { setFocus(false); setDismissed(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") setDismissed(true); }}
    >
      {children}
      {/* the padding bridges the gap so the pointer can move onto the tooltip without it closing */}
      <span
        aria-hidden="true"
        data-tip=""
        className={`absolute z-50 ${ALIGN[align]} ${SIDE[side]} ${show ? "visible opacity-100" : "invisible opacity-0"} transition-opacity duration-100 motion-reduce:transition-none`}
      >
        <span className="block whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-white/40">{label}</span>
      </span>
    </span>
  );
}

const VARIANTS = {
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-brand-dark",
  soft: "bg-brand/10 text-brand-dark hover:bg-brand/20",
  solid: "bg-brand text-white hover:bg-brand-dark",
  light: "bg-white text-ink hover:bg-accent",
  outline: "border border-slate-400 text-slate-800 hover:bg-slate-100",
  danger: "text-red-800 hover:bg-red-50",
  onDark: "text-white/85 hover:bg-white/10 hover:text-white",
  active: "bg-brand text-white",
};
const SIZES = { sm: "h-9 w-9", md: "h-10 w-10", lg: "h-12 w-12" };

export default function IconAction({ label, icon, href, onClick, type = "button", disabled = false, variant = "ghost", size = "md", align, side, className = "", ...rest }) {
  const cls = `inline-flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full transition disabled:cursor-wait disabled:opacity-60 ${VARIANTS[variant]} ${className}`;
  const inner = <span aria-hidden="true" className="grid place-items-center [&>svg]:h-5 [&>svg]:w-5">{icon}</span>;
  return (
    <Tip label={label} align={align} side={side}>
      {href ? (
        <Link href={href} aria-label={label} className={cls} {...rest}>{inner}</Link>
      ) : (
        <button type={type} aria-label={label} onClick={onClick} disabled={disabled} className={cls} {...rest}>{inner}</button>
      )}
    </Tip>
  );
}
