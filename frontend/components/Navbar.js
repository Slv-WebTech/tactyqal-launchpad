import Link from "next/link";
import { Trophy, Route, Heart, Wrench, BookOpen, IndianRupee, CircleHelp, CalendarCheck, Menu, X } from "lucide-react";
import IconAction from "./IconAction";

// Icon-first navigation. Desktop: icon-only links with tooltips. Mobile (no hover): icon + label list.
export const NAV = [
  ["Success Stories", "/#success", Trophy],
  ["Program", "/#program", Route],
  ["Why Us", "/#why", Heart],
  ["Tools", "/#tools", Wrench],
  ["Blog", "/blog", BookOpen],
  ["Pricing", "/#pricing", IndianRupee],
  ["FAQ", "/#faq", CircleHelp],
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">T</span>
          Tactyqal<span className="text-brand-dark">Labs</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map(([label, href, Icon]) => (
            <IconAction key={label} label={label} href={href} icon={<Icon />} />
          ))}
        </nav>

        <span className="hidden lg:block">
          <IconAction label="Free consultation" href="/#contact" icon={<CalendarCheck />} variant="solid" align="end" />
        </span>

        {/* CSS-only mobile menu (no client JS needed) */}
        <details className="group relative lg:hidden">
          <summary aria-label="Menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 [&::-webkit-details-marker]:hidden">
            <Menu aria-hidden="true" className="h-5 w-5 group-open:hidden" />
            <X aria-hidden="true" className="hidden h-5 w-5 group-open:block" />
          </summary>
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {NAV.map(([label, href, Icon]) => (
              <Link key={label} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50">
                <Icon aria-hidden="true" className="h-5 w-5 text-brand-dark" />
                {label}
              </Link>
            ))}
            <Link href="/#contact" className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white">
              <CalendarCheck aria-hidden="true" className="h-5 w-5" />
              Free consultation
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
