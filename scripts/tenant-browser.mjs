import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { provisionTenant, tenantConfiguration, launchTenant } from './tenant-runtime.mjs';

const directory = mkdtempSync(join(tmpdir(), 'veyra-tenant-browser-'));
provisionTenant('browser-qa', 4110, directory);
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
await launchTenant(tenantConfiguration('browser-qa', directory), { signal: controller.signal });
console.log('Isolated tenant ready at http://localhost:4110; data: ' + directory);
