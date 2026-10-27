/** An expected request error whose message is safe to return from a public API. */
export class PublicDataInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicDataInputError";
  }
}
