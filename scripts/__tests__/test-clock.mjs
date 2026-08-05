const NativeDate = globalThis.Date;
const fixedNow = NativeDate.parse('2026-08-02T13:44:00Z');

class FixedDate extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }

  static now() {
    return fixedNow;
  }
}

FixedDate.parse = NativeDate.parse;
FixedDate.UTC = NativeDate.UTC;
globalThis.Date = FixedDate;
