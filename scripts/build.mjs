import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('public/', root);
// A fixed output directory; never copy backend files or environment variables.
await rm(fileURLToPath(output), { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const relative of ['index.html', 'assets', 'src/app', 'src/framework', 'src/shared', 'src/styles']) {
  const destination = new URL(relative, output);
  await mkdir(new URL('./', destination), { recursive: true });
  await cp(new URL(relative, root), destination, { recursive: true });
}
