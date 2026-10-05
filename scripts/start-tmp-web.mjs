// Compatibility entry for the retired fork launcher. Use the unmodified official build copy.
// Preserve the old temp-profile/port defaults; all validation and installation has one owner.
process.env.DSH_TMP_ROOT ??= '/private/tmp/dsh-zcode-web';
process.env.DSH_TMP_PORT ??= '3092';
await import('./start-official-web.mjs');
