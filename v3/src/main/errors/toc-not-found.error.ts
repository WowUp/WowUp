export class TocNotFoundError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TocNotFoundError.prototype)
  }
}
