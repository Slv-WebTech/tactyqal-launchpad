import Link from "next/link";

export const NAV = [
  ["Success Stories", "/#success"], ["Program", "/#program"], ["Why Us", "/#why"],
  ["Tools", "/#tools"], ["Blog", "/blog"], ["Pricing", "/#pricing"], ["FAQ", "/#faq"],
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">T</span>
          Tactyqal<span className="text-brand">Labs</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          {NAV.map(([label, href]) => (
            <Link key={label} href={href} className="transition hover:text-brand">{label}</Link>
          ))}
        </nav>
        <Link href="/#contact" className="hidden rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark lg:block">
          Free consultation
        </Link>
        {/* CSS-only mobile menu (no client JS needed) */}
        <details className="group relative lg:hidden">
          <summary aria-label="Menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-xl [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">☰</span><span className="hidden group-open:inline">✕</span>
          </summary>
          <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {NAV.map(([label, href]) => (
              <Link key={label} href={href} className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50">{label}</Link>
            ))}
            <Link href="/#contact" className="mt-1 block rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white">Free consultation</Link>
          </div>
        </details>
      </div>
    </header>
  );
}
