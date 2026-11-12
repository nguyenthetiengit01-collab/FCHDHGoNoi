import { cookies } from "next/headers";
import { getFullAppData } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  sanitizeDataForPublic,
  sanitizeDataForPlayer,
} from "@/lib/auth";
import { TeamManagerApp } from "@/components/TeamManagerApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getFullAppData();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

  let initialData = sanitizeDataForPublic(data);

  if (session && session.accessRole === "manager") {
    initialData = {
      ...data,
      players: data.players.map((p) => ({ ...p, pin_code: "" })),
    };
  } else if (session) {
    initialData = sanitizeDataForPlayer(data, session.playerId);
  }

  return <TeamManagerApp initialData={initialData} />;
}

