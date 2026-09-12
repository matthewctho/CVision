import { cookies } from "next/headers";
import { googleAuthCookies, readSession } from "@/lib/google/auth";
import ParkwiseApp from "../src/main";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(googleAuthCookies.session)?.value);
  const demo = cookieStore.get(googleAuthCookies.demo)?.value === "1";

  return <ParkwiseApp initialSignedIn={Boolean(session) || demo} />;
}
