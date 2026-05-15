import { parseBearer, verifySupabaseUserJwt } from './lib/auth.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: JSON_HEADERS,
  });
}

function isPublicApiPath(pathname) {
  return (
    pathname === '/api/species' ||
    pathname === '/api/species/' ||
    pathname === '/api/estimate' ||
    pathname === '/api/estimate/'
  );
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const { pathname } = url;

  if (!pathname.startsWith('/api/')) {
    return context.next();
  }

  if (isPublicApiPath(pathname)) {
    return context.next();
  }

  const token = parseBearer(context.request);
  if (!token) {
    return unauthorized();
  }

  try {
    await verifySupabaseUserJwt(token, context.env);
  } catch {
    return unauthorized();
  }

  return context.next();
}
