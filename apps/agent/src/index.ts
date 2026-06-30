import { APP_NAME } from '@speakcore/shared';
import { loadConfig } from './config';
import { buildServer } from './server';

const config = loadConfig();
const server = buildServer(config);

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[agent] ${APP_NAME} listening on http://localhost:${config.port}`);
});
