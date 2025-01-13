
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)'])
const isPrivateRoute = createRouteMatcher([
  '/candidate(.*)', // Matches /candidate and any subpaths
  '/proctor(.*)',   // Matches /proctor and any subpaths
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth()

  if (!userId && isPrivateRoute(req)) {
    // Add custom logic to run before redirecting
    console.log('User is not signed in')
    console.log('Redirecting to /signin',userId)
    // return NextResponse.redirect('/signin')
    return NextResponse.redirect(new URL('/Signup', req.url))

    return redirectToSignIn()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}