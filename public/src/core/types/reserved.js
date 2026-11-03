// Codes made by the full version of this app: Data (QD1:), compressed Data
// (QC1:), encrypted (QE1:) and any later version of those families. This app
// doesn't read them; it says so and points to the full app, rather than
// showing their contents as raw text that looks like garbage.

const FAMILY = /^Q[CDE]\d+:/;

export const reserved = {
  id: 'reserved',
  label: 'Full-app code',

  detect(payload) {
    return FAMILY.test(payload);
  },

  encode() {
    throw new Error('This payload type is not supported in this app');
  },

  decode(payload) {
    const prefix = payload.match(FAMILY)[0];
    return { ok: true, data: { prefix, reason: prefix.startsWith('QE') ? 'encrypted' : 'data' } };
  },
};
