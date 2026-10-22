import { redirect } from "next/navigation";

// Legacy route — everything now lives on the unified manage page.
export default async function LegacySecretsPage({
  params,
}: {
  params: Promise<{ repo: string }>;
}) {
  const { repo } = await params;
  redirect(`/repos/${repo}/manage?tab=secrets`);
}
