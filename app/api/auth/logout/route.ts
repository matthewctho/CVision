import { NextRequest, NextResponse } from "next/server";
import { googleAuthCookies } from "@/lib/google/auth";

function logoutResponse(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.cookies.set(googleAuthCookies.session, "", { path: "/", maxAge: 0 });
  response.cookies.set(googleAuthCookies.demo, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  return logoutResponse(request);
}

export async function POST(request: NextRequest) {
  return logoutResponse(request);
}
