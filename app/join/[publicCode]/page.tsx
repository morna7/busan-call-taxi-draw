import { JoinDrawClient } from "@/components/public/JoinDrawClient";

export default async function JoinPage({
  params
}: {
  params: Promise<{ publicCode: string }>;
}) {
  const { publicCode } = await params;
  return <JoinDrawClient publicCode={publicCode} />;
}
