import { provisionTenant, tenantConfiguration, launchTenant } from './tenant-runtime.mjs';

const [command, id, port] = process.argv.slice(2);
try {
  if (command === 'init') {
    const directory = provisionTenant(id || '', Number(port));
    console.log('Created tenant configuration: ' + directory);
    console.log('Configure its private .env, then run: npm run tenant -- start ' + id);
  } else if (command === 'start' && id && !port) {
    const config = tenantConfiguration(id);
    const controller = new AbortController();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => controller.abort());
    const runtime = await launchTenant(config, { signal: controller.signal });
    console.log('Tenant ' + id + ' ready at ' + config.env.FRONTEND_URL);
    const failure = await runtime.finished;
    if (failure) throw failure;
  } else throw new Error('Usage: npm run tenant -- init <tenant-id> <base-port> | start <tenant-id>');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
