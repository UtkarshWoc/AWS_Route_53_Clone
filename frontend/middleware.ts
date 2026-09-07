import { NextResponse } from 'next/server'; import type { NextRequest } from 'next/server';
export function middleware(request:NextRequest) { // UX shortcut only: FastAPI validates the session and resource ownership.
 if (!request.cookies.get('route53_session')) return NextResponse.redirect(new URL('/login',request.url)); return NextResponse.next();
} export const config={matcher:['/dashboard','/hosted-zones/:path*','/traffic-policies','/health-checks','/resolver','/profiles']};
