import type { PredictionRuntime } from "@/lib/interactiveWidgets";

export type ParticlePhase =
  | "IDLE"
  | "OPENING"
  | "VOTING"
  | "CLOSING"
  | "WAITING_FOR_RESULT"
  | "REVEALING_WINNER"
  | "RESULT_DISPLAY"
  | "HIDDEN";
export type PredictionPresentation = {
  phase: ParticlePhase;
  runtime: PredictionRuntime | null;
  key: number;
  until: number;
};
export type PredictionReceipt = {
  identity: string;
  cycle: string;
  status: string;
  revealed: string | null;
};

export function predictionIdentity(runtime: PredictionRuntime) {
  // Provider outcome IDs identify the prediction when no top-level prediction ID is supplied.
  return JSON.stringify(runtime.outcomes.map((outcome) => outcome.id));
}

export function officialWinner(runtime: PredictionRuntime | null) {
  return runtime?.status === "resolved" && runtime.winnerId !== null
    ? runtime.outcomes.slice(0, 2).findIndex((outcome) => outcome.id === runtime.winnerId)
    : -1;
}

export const emptyPresentation = (): PredictionPresentation => ({
  phase: "IDLE",
  runtime: null,
  key: 0,
  until: 0,
});

/** Source events choose the phase; deadlines only finish the selected visual transition. */
export class PredictionParticleLifecycle {
  presentation = emptyPresentation();
  receipt: PredictionReceipt | null;
  constructor(receipt: PredictionReceipt | null) {
    this.receipt = receipt;
  }

  receive(
    runtime: PredictionRuntime | null,
    now: number,
    revealDuration: number,
    opening: boolean,
  ) {
    const previous = this.presentation;
    if (!runtime || runtime.status === "idle" || runtime.outcomes.length < 2) {
      if (this.receipt) this.receipt = { ...this.receipt, status: "idle" };
      this.presentation =
        previous.runtime && !["IDLE", "HIDDEN", "WAITING_FOR_RESULT"].includes(previous.phase)
          ? {
              ...previous,
              phase: "CLOSING",
              until: previous.phase === "CLOSING" ? previous.until : now + 750,
            }
          : { ...previous, phase: "IDLE", runtime: null };
      return;
    }
    const identity = predictionIdentity(runtime);
    if (runtime.status === "open") {
      const newCycle =
        !this.receipt || this.receipt.identity !== identity || this.receipt.status !== "open";
      if (newCycle)
        this.receipt = {
          identity,
          cycle: `${runtime.updatedAt ?? now}:${runtime.revision}`,
          status: "open",
          revealed: null,
        };
      if (newCycle || !["OPENING", "VOTING"].includes(previous.phase)) {
        this.presentation = {
          phase: opening ? "OPENING" : "VOTING",
          runtime,
          key: previous.key + 1,
          until: opening ? now + 450 : 0,
        };
      } else this.presentation = { ...previous, runtime };
      return;
    }
    if (!this.receipt || this.receipt.identity !== identity) {
      this.receipt = {
        identity,
        cycle: `${runtime.updatedAt ?? now}:${runtime.revision}`,
        status: runtime.status,
        revealed: null,
      };
    }
    this.receipt.status = runtime.status;
    if (runtime.status === "locked" || officialWinner(runtime) < 0) {
      const showing = [
        "OPENING",
        "VOTING",
        "REVEALING_WINNER",
        "RESULT_DISPLAY",
        "CLOSING",
      ].includes(previous.phase);
      this.presentation = showing
        ? {
            ...previous,
            phase: "CLOSING",
            until: previous.phase === "CLOSING" ? previous.until : now + 750,
          }
        : { ...previous, phase: "WAITING_FOR_RESULT", runtime: null };
      return;
    }
    const result = `${this.receipt.cycle}:${runtime.winnerId}`;
    if (this.receipt.revealed === result) {
      if (["REVEALING_WINNER", "RESULT_DISPLAY"].includes(previous.phase)) {
        this.presentation = { ...previous, runtime };
      }
      return;
    }
    this.receipt.revealed = result;
    if (runtime.hideAt && Date.parse(runtime.hideAt) <= now) {
      this.presentation = { ...previous, phase: "HIDDEN", runtime: null };
      return;
    }
    this.presentation = {
      phase: "REVEALING_WINNER",
      runtime,
      key: previous.key + 1,
      until: now + revealDuration,
    };
  }

  tick(now: number, resultDuration: number) {
    const previous = this.presentation;
    if (!previous.until || now < previous.until) return;
    switch (previous.phase) {
      case "OPENING":
        this.presentation = { ...previous, phase: "VOTING", until: 0 };
        break;
      case "CLOSING":
        this.presentation = {
          ...previous,
          phase: this.receipt?.status === "locked" ? "WAITING_FOR_RESULT" : "HIDDEN",
          runtime: null,
          until: 0,
        };
        break;
      case "REVEALING_WINNER":
        this.presentation = { ...previous, phase: "RESULT_DISPLAY", until: now + resultDuration };
        break;
      case "RESULT_DISPLAY":
        this.presentation = { ...previous, phase: "CLOSING", until: now + 750 };
        break;
    }
  }
}

export function readPredictionReceipt(
  storage: Pick<Storage, "getItem">,
  key: string,
): PredictionReceipt | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null) throw new Error("invalid_prediction_receipt");
  const record = value as Record<string, unknown>;
  if (
    typeof record["identity"] !== "string" ||
    typeof record["cycle"] !== "string" ||
    typeof record["status"] !== "string" ||
    (record["revealed"] !== null && typeof record["revealed"] !== "string")
  ) {
    throw new Error("invalid_prediction_receipt");
  }
  return {
    identity: record["identity"],
    cycle: record["cycle"],
    status: record["status"],
    revealed: record["revealed"],
  };
}
