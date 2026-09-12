import { NextRequest, NextResponse } from "next/server";
import { googleAuthCookies } from "@/lib/google/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.delete(googleAuthCookies.session);
  response.cookies.delete(googleAuthCookies.demo);
  return response;
}
