export class BookingError extends Error {
    code;
    step;
    constructor(code, message, step) {
        super(message);
        this.name = "BookingError";
        this.code = code;
        this.step = step;
    }
}
export function asError(input) {
    if (input instanceof Error)
        return input;
    return new Error(typeof input === "string" ? input : JSON.stringify(input));
}
