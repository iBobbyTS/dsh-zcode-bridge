/** Shared B02 routing oracle. These addresses describe test producers, not official GUI storage. */
export const B02=Object.freeze({
  D1:Object.freeze({runtime:'native',authority:'https://dsh.test',workspace:'native-session-store',sessionId:'same-id'}),
  Z1:Object.freeze({runtime:'zcode',authority:'official-headless:b02-fixture',workspace:'/b02-workspace',sessionId:'same-id'}),
  unknown:Object.freeze({runtime:'unknown',authority:'unknown',workspace:'/b02-workspace',sessionId:'same-id'}),
  initialDefault:'zcode',newDefault:'native',
});
