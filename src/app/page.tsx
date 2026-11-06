import { getFullAppData } from "@/lib/db";
import { TeamManagerApp } from "@/components/TeamManagerApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getFullAppData();
  return <TeamManagerApp initialData={initialData} />;
}

