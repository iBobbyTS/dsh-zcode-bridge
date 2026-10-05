# dsh-zcode-bridge

ZCode runs through the official installed Host/app-server and appears in the official
DSH conversation UI as a registered Agent. The native DSH factory remains available.
New sessions default to ZCode; the Hero selects the runtime for the next creation.
Existing sessions display their locked runtime. The composer model seat forwards
ZCode provider/model/effort choices to the official execution channel.

Build with `npm ci --ignore-scripts && npm run build`; validate with `npm test`.
Install this bundle into an official DSH web profile. Configure the host-backed
launcher with its existing isolated launch configuration; credentials remain inside
the official process. The plugin starts its connection automatically. An unavailable
launcher produces an explicit error instead of creating a native replacement.

ZCode transcripts and identity bindings are stored under `DSH_HOME/zcode-bridge/`.
Boot re-registers these Agents. Commands use a bounded authenticated launcher channel;
lost acknowledgements are queried by their persisted command ID and never resent
with a fresh ID automatically. Permission decisions use DSH's approval UI and report
`assumed-single-answerer`; detecting another client's winning response is unproven.
The composer displays “官方 GUI 可能正在运行本会话”. No deletion entry is provided.

The fork-era conversation/directory bootstrap is retired from the shipped client.
The official catalog supplies prefixed ZCode rows. The composer lifecycle dock shows
the official queue, steer disposition, active work, stop availability, and distinct
accepted/queued/rejected/unknown receipts. Queue edit and send-now use official guards;
there is no queue removal control. Stop targets the currently confirmed foreground
execution. Idle conversation subscriptions release after 30 seconds without a mounted
composer, queued/active work, or unresolved input; the resident transcript stays intact.
The carrier supports 64 simultaneous subscriptions and reports explicit capacity errors.
After disconnect, the displayed prefix stays visible, recovery queries original command
IDs, and a fresh official snapshot supplies the queue and control state. Development fixtures and capability spikes are excluded from publication.

Only App-owned Electron Host/CLI artifacts are launched. Existing sandbox, HOME,
credential, and exact-process ownership restrictions remain in force. The bridge
never reads or exports credentials. Shared-GUI arbitration is only proven within
this Host; another official GUI process may be running the same session.
