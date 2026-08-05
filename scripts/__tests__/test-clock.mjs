const fixedNow = Date.parse('2026-08-02T13:44:00Z');
globalThis.Date.now = function nowForDeterministicTests() {
  return fixedNow;
};
