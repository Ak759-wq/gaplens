/** Thrown by pipeline stages that are intentionally not implemented yet. Never replaced by fake output. */
export class NotImplementedError extends Error {
  readonly phase: number;
  constructor(stage: string, phase: number) {
    super(`${stage} is not implemented yet (planned for Phase ${phase}).`);
    this.name = "NotImplementedError";
    this.phase = phase;
  }
}
