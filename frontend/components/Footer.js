import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-ink text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-white">Tactyqal<span className="text-accent">Labs</span></p>
          <p className="mt-3 max-w-xs text-sm">Turning young builders' ideas into launched products.</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Explore</p>
          <ul className="space-y-2">
            <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
            <li><Link href="/#pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/admin" className="hover:text-white">Blog admin</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Contact</p>
          <ul className="space-y-2">
            <li>tactyqal.labs@gmail.com</li><li>+91-98047-72106</li><li>Mon–Sat, 9am–7pm</li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Tactyqal Labs. Redesign concept for the hire-a-thon.</p>
    </footer>
  );
}
