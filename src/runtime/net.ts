import net from "node:net";

/**
 * Ports the Fetch spec tells clients to refuse outright
 * (https://fetch.spec.whatwg.org/#port-blocking). Node's `fetch` enforces the
 * list, so a server bound to one of them is unreachable from `waitForHealth`
 * and the PocketBase SDK alike: the request fails with cause "bad port"
 * before a connection is even attempted. 10080 sat inside the 10000–19999
 * range ports used to be drawn from, and cost a CI run a 30-second health
 * timeout whenever the draw landed on it.
 */
export const BAD_PORTS: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

function osAssignedPort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/**
 * A port nothing is listening on right now, taken from the OS's ephemeral
 * range so it neither collides with whatever else the machine runs nor hits
 * `BAD_PORTS`. The port is released again before this resolves, so the
 * caller's server has to bind it promptly.
 */
export async function freePort(host: string): Promise<number> {
  for (;;) {
    const port = await osAssignedPort(host);
    if (!BAD_PORTS.has(port)) return port;
  }
}

// Wait for the port to be available. A cold `npx pocketbase-server` on a CI
// runner can take well over the five seconds the old default allowed.
export function waitForPort(
  port: number,
  host: string,
  maxAttempts = 60,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryConnect = () => {
      attempts++;

      const socket = new net.Socket();

      const onError = () => {
        socket.destroy();

        if (attempts === maxAttempts) {
          reject(
            new Error(`Timed out waiting for port ${port} to be available`),
          );
          return;
        }

        setTimeout(tryConnect, 500);
      };

      socket.once("error", onError);

      socket.connect(port, host, () => {
        socket.destroy();
        resolve();
      });
    };

    tryConnect();
  });
}

/**
 * `fetch` wraps the interesting part in `cause`: an errno error for a
 * connection that was refused, or a bare string such as "bad port" for a
 * request undici declined to make.
 */
function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { cause } = error as Error & { cause?: unknown };
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    return code || cause.message || error.message;
  }
  if (cause !== undefined) return String(cause);
  return error.message;
}

// Wait for the health check to be successful
export function waitForHealth(url: string, maxAttempts = 60): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let lastFailure = "no attempt made";

    const tryHealth = async () => {
      attempts++;

      try {
        const response = await fetch(`${url}/api/health`);
        if (response.status === 200) {
          resolve();
          return;
        }
        lastFailure = `HTTP ${response.status}`;
      } catch (error) {
        lastFailure = describeFetchError(error);
      }

      if (attempts === maxAttempts) {
        reject(
          new Error(
            `Timed out waiting for health check at ${url}/api/health (last attempt: ${lastFailure})`,
          ),
        );
        return;
      }

      setTimeout(tryHealth, 500);
    };

    tryHealth();
  });
}
