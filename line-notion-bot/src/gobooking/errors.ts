import type { BookingStep } from "./types.js";

export class BookingError extends Error {
  code: string;
  step?: BookingStep;

  constructor(code: string, message: string, step?: BookingStep) {
    super(message);
    this.name = "BookingError";
    this.code = code;
    this.step = step;
  }
}

export function asError(input: unknown): Error {
  if (input instanceof Error) return input;
  return new Error(typeof input === "string" ? input : JSON.stringify(input));
}
