import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ repo: string }>;
}): Promise<Metadata> {
  const { repo } = await params;
  return { title: decodeURIComponent(repo) };
}

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
