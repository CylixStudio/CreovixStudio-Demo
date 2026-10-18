/** In-process wakeups for the Demo overlay. Not a queue and not used in production. */
export function createRevisionGate() {
  let revision = 0;
  let waiters: Array<() => void> = [];

  return {
    current(): number {
      return revision;
    },
    bump(): number {
      revision += 1;
      const pending = waiters;
      waiters = [];
      for (const wake of pending) wake();
      return revision;
    },
    wait(since: number, signal: AbortSignal, timeoutMs: number): Promise<number> {
      if (signal.aborted || revision !== since) return Promise.resolve(revision);
      return new Promise<number>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          waiters = waiters.filter((item) => item !== finish);
          resolve(revision);
        };
        const timer = setTimeout(finish, timeoutMs);
        waiters.push(finish);
        signal.addEventListener("abort", finish);
        if (revision !== since || signal.aborted) finish();
      });
    },
  };
}

export const demoRevisionGate = createRevisionGate();
