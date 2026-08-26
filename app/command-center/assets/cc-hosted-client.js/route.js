import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function GET() {
  const filePath = join(process.cwd(), 'packages/cc/src/ui/cc-hosted-client.js');
  const body = readFileSync(filePath, 'utf8');
  return new Response(body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
