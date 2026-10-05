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
Catalog synchronization and additional lifecycle/settings surfaces belong to later
sections. Development fixtures and capability spikes are excluded from publication.

Only App-owned Electron Host/CLI artifacts are launched. Existing sandbox, HOME,
credential, and exact-process ownership restrictions remain in force. The bridge
never reads or exports credentials. Shared-GUI arbitration is only proven within
this Host; another official GUI process may be running the same session.
