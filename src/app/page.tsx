import { getFullAppData } from "@/lib/db";
import { TeamManagerApp } from "@/components/TeamManagerApp";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const initialData = getFullAppData();
  return <TeamManagerApp initialData={initialData} />;
}

