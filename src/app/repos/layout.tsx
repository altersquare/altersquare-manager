import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Repositories · GitHub Manager", template: "%s · GitHub Manager" },
};

export default function ReposLayout({ children }: { children: React.ReactNode }) {
  return children;
}
