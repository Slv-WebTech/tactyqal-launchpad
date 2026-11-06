import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-5 py-32 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link href="/" className="mt-4 inline-block text-brand">Go home</Link>
    </div>
  );
}
