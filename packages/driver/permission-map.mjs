export const FORWARD_PRESET_MAP=Object.freeze({
  'read-only':'build',
  'workspace-write':'edit',
  'danger-full-access':'yolo',
});

export const REVERSE_MODE_MAP=Object.freeze({
  'build':'read-only',
  'edit':'workspace-write',
  'yolo':'danger-full-access',
});

export const REVERSE_BUNDLE_MAP=Object.freeze({
  'read-only':Object.freeze({sandbox:'read-only',approval:'ask'}),
  'workspace-write':Object.freeze({sandbox:'workspace-write',approval:'ask'}),
  'danger-full-access':Object.freeze({sandbox:'danger-full-access',approval:'never'}),
});

export function mapPreset(preset){
  return Object.hasOwn(FORWARD_PRESET_MAP,preset)?FORWARD_PRESET_MAP[preset]:undefined;
}

export function mapMode(mode){
  return Object.hasOwn(REVERSE_MODE_MAP,mode)?REVERSE_MODE_MAP[mode]:undefined;
}

export function presetBundle(preset){
  return Object.hasOwn(REVERSE_BUNDLE_MAP,preset)?REVERSE_BUNDLE_MAP[preset]:undefined;
}

export function modeBundle(mode){
  const preset=mapMode(mode);
  return preset?presetBundle(preset):undefined;
}
