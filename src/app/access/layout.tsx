import type { Metadata } from "next";

export const metadata: Metadata = { title: "Access review" };

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
