import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const isIpAccess = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(host)
  const pathname = request.nextUrl.pathname

  // API and static files always pass through
  if (pathname.startsWith('/api/')) return NextResponse.next()
  if (pathname.startsWith('/_next/')) return NextResponse.next()
  if (pathname.includes('.')) return NextResponse.next()

  // Block Payload's built-in admin when accessed via domain
  if (!isIpAccess && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}
