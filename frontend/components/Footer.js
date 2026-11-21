import { BookOpen, IndianRupee, Settings, Mail, Phone, Clock } from "lucide-react";
import IconAction from "./IconAction";

export default function Footer() {
  return (
    <footer className="bg-ink text-white/75">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-white">Tactyqal<span className="font-semibold text-white/80">Labs</span></p>
          <p className="mt-3 max-w-xs text-sm">Turning young builders' ideas into launched products.</p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <p className="mb-3 font-semibold text-white">Explore</p>
          <div className="flex gap-1">
            <IconAction label="Blog" href="/blog" icon={<BookOpen />} variant="onDark" side="top" />
            <IconAction label="Pricing" href="/#pricing" icon={<IndianRupee />} variant="onDark" side="top" />
            <IconAction label="Blog admin" href="/admin" icon={<Settings />} variant="onDark" side="top" />
          </div>
        </nav>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Contact</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only">Email: </span>tactyqal.labs@gmail.com</li>
            <li className="flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only">Phone: </span>+91-98047-72106</li>
            <li className="flex items-center gap-2"><Clock aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only">Hours: </span>Mon–Sat, 9am–7pm</li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs">© {new Date().getFullYear()} Tactyqal Labs. Redesign concept for the hire-a-thon.</p>
    </footer>
  );
}
