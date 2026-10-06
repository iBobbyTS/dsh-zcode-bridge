// Compatibility entry for the conversation-runtime operator profile. The retired fork/ledger setup is replaced
// by the official launcher and real plugin manager; DSH profile remains isolated.
import { fileURLToPath } from 'node:url';
process.env.DSH_TMP_ROOT ??= fileURLToPath(new URL('../../.agent-work/tmp/conversation-runtime-web', import.meta.url));
process.env.DSH_TMP_PORT ??= '3092';
await import('./start-official-web.mjs');
