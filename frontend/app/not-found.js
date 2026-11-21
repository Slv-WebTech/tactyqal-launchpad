import { House } from "lucide-react";
import IconAction from "@/components/IconAction";

export default function NotFound() {
  return (
    <div className="px-5 py-32 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <div className="mt-6 flex justify-center">
        <IconAction label="Go home" href="/" icon={<House />} variant="solid" size="lg" />
      </div>
    </div>
  );
}
