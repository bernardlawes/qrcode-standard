// Plain text: raw, no prefix. The catch-all — always detected last.

export const text = {
  id: 'text',
  label: 'Text',

  detect() {
    return true;
  },

  /** @param {{ text: string }} data */
  encode({ text }) {
    if (typeof text !== 'string' || text.length === 0) throw new Error('Text is empty');
    return text;
  },

  decode(payload) {
    return { ok: true, data: { text: payload } };
  },
};
