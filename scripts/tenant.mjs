import {
  backupTenant, decommissionTenant, launchTenant, provisionTenant, restoreTenant,
  tenantConfiguration, verifyTenantBackup,
} from './tenant-runtime.mjs';

const [command, first, second, third] = process.argv.slice(2);
try {
  if (command === 'init') {
    const id = first;
    const directory = provisionTenant(id || '', Number(second));
    console.log('Created tenant configuration: ' + directory);
    console.log('Configure its private .env, then run: npm run tenant -- start ' + id);
  } else if (command === 'start' && first && !second) {
    const id = first;
    const config = tenantConfiguration(id);
    const controller = new AbortController();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
    const runtime = await launchTenant(config, { signal: controller.signal });
    console.log('Tenant ' + id + ' ready at ' + config.env.FRONTEND_URL);
    const failure = await runtime.finished;
    if (failure) throw failure;
  } else if (command === 'backup' && first && second && !third) {
    console.log('Verified backup created: ' + backupTenant(first, second));
  } else if (command === 'verify-backup' && first && !second) {
    const manifest = verifyTenantBackup(first);
    console.log(`Backup verified for ${manifest.tenant_id}: ${manifest.files.length} files`);
  } else if (command === 'restore' && first && second && !third) {
    console.log('Tenant restored: ' + restoreTenant(first, second));
  } else if (command === 'decommission' && first && second && third?.startsWith('--confirm=')) {
    console.log('Tenant decommissioned; verified recovery backup: '
      + decommissionTenant(first, second, third.slice('--confirm='.length)));
  } else throw new Error([
    'Usage:',
    '  npm run tenant -- init <tenant-id> <base-port>',
    '  npm run tenant -- start <tenant-id>',
    '  npm run tenant -- backup <tenant-id> <new-backup-directory>',
    '  npm run tenant -- verify-backup <backup-directory>',
    '  npm run tenant -- restore <backup-directory> <tenant-id>',
    '  npm run tenant -- decommission <tenant-id> <new-backup-directory> --confirm=<tenant-id>',
  ].join('\n'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
