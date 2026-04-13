import net from "node:net";

// Generate a random port
export function randomPort() {
  return Math.floor(Math.random() * 10000) + 10000;
}

// Wait for the port to be available
export function waitForPort(
  port: number,
  host: string,
  maxAttempts = 10,
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

// Wait for the health check to be successful
export function waitForHealth(url: string, maxAttempts = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryHealth = async () => {
      attempts++;

      try {
        const response = await fetch(`${url}/api/health`);
        if (response.status === 200) {
          resolve();
          return;
        }
      } catch {
        // Ignore fetch errors and continue retrying
      }

      if (attempts === maxAttempts) {
        reject(
          new Error(`Timed out waiting for health check at ${url}/api/health`),
        );
        return;
      }

      setTimeout(tryHealth, 500);
    };

    tryHealth();
  });
}
