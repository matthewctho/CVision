import { cookies } from "next/headers";
import { googleAuthCookies, readSession } from "@/lib/google/auth";
import ParkwiseApp from "./components/ParkwiseApp";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(googleAuthCookies.session)?.value);

  return <ParkwiseApp initialSignedIn={Boolean(session)} userName={session?.name} />;
}
