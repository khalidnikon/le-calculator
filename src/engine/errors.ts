/** Error 1–8, per the guidebook's Error Messages table (see PRD "Errors"). */
export type ErrorCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export class CalcError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(`Error ${code}`);
  }
}

export function fail(code: ErrorCode): never {
  throw new CalcError(code);
}
