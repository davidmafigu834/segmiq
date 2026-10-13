/** Fail-closed denial. Callers must not catch this and query production CRM tables. */
export class DemoAccessDenied extends Error {
  readonly status = 404 as const;

  constructor(message = "Not found") {
    super(message);
    this.name = "DemoAccessDenied";
  }
}
