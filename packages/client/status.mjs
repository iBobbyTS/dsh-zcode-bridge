export const initialClientStatus=()=>({state:'unavailable',reason:'host-unreachable',auth:'unconfirmed',connected:false});
const reasons={
 'not-connected':'Not connected',connecting:'Connecting to official runtime…',
 'installation-missing':'Official ZCode installation was not found',
 'installation-ambiguous':'Multiple installations found; configure the intended App path',
 'helper-missing':'The official Electron helper is missing',
 'runtime-missing':'The official runtime bundle is missing',
 'provider-config-missing':'The official provider configuration is missing',
 'installation-metadata-invalid':'The App metadata does not identify official ZCode',
 'launcher-unusable':'The official Electron Node launcher could not be verified',
 'workspace-required':'Configure a dedicated workspace before connecting',
 'workspace-missing':'The configured workspace does not exist',
 'official-auth-source-missing':'Restricted: protocol connected; official request authentication unavailable',
 'runtime-unverified':'Restricted: this installation tuple has not been verified',
 'host-unreachable':'Host unavailable; refresh after reconnecting',
 disposed:'Connection disposed', 'request-timeout':'Official request timed out; execution state is unknown',
 'protocol-invalid':'Official protocol frame was invalid', 'transport-eof':'Official runtime disconnected',
 'transport-error':'Official runtime transport failed', 'launch-failed':'Official runtime launch failed',
 'unsupported-platform':'This bridge currently supports macOS',
 'runtime-rejected':'Official runtime rejected the request',
 'capabilities-invalid':'Official capability response is incompatible','sessions-invalid':'Official session response is incompatible',
};
export function statusText(state){return reasons[state.reason]??'Unavailable: connection state is unconfirmed'}
