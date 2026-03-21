import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(req: NextRequest) {
  // If Supabase isn't configured yet, don't block access.
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        // Write refreshed cookies back to both the forwarded request
        // and the outgoing response so that Server Components and
        // Route Handlers can always read a valid session.
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: req.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
        );
      },
    },
  });

  // Refresh the session (rotates tokens if needed).
  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard pages — redirect to login if not authenticated.
  if (!user && req.nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public assets (svg, png, etc.)
     *
     * This ensures the middleware runs on both page routes and API
     * routes so that session cookies are always refreshed.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
