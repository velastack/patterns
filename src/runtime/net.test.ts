import { afterEach, describe, expect, it } from "vitest";
import http from "node:http";
import net from "node:net";
import { BAD_PORTS, freePort, waitForHealth, waitForPort } from "./net";

const HOST = "localhost";
const servers: (net.Server | http.Server)[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

function listen(server: net.Server | http.Server, port: number): Promise<void> {
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => resolve());
  });
}

describe("freePort", () => {
  it("returns a port a server can bind immediately", async () => {
    const port = await freePort(HOST);
    expect(port).toBeGreaterThan(0);
    await expect(listen(net.createServer(), port)).resolves.toBeUndefined();
  });

  it("never hands out a port fetch refuses to talk to", async () => {
    // The CI failure this guards against: PocketBase came up on 10080 and
    // every health probe died client-side with "bad port".
    expect(BAD_PORTS.has(10080)).toBe(true);
    for (let i = 0; i < 20; i++) {
      expect(BAD_PORTS.has(await freePort(HOST))).toBe(false);
    }
  });
});

describe("waitForHealth", () => {
  it("resolves once /api/health answers 200", async () => {
    const port = await freePort(HOST);
    const server = http.createServer((req, res) => {
      res.statusCode = req.url === "/api/health" ? 200 : 404;
      res.end();
    });
    await listen(server, port);
    await expect(
      waitForHealth(`http://${HOST}:${port}`, 3),
    ).resolves.toBeUndefined();
  });

  it("names a Fetch-spec bad port as the reason for giving up", async () => {
    await expect(waitForHealth(`http://${HOST}:10080`, 1)).rejects.toThrow(
      /Timed out waiting for health check .*last attempt: bad port/,
    );
  });

  it("reports the connection error when nothing is listening", async () => {
    const port = await freePort(HOST);
    await expect(waitForHealth(`http://${HOST}:${port}`, 1)).rejects.toThrow(
      /last attempt: ECONNREFUSED/,
    );
  });

  it("reports a non-200 status", async () => {
    const port = await freePort(HOST);
    const server = http.createServer((_req, res) => {
      res.statusCode = 503;
      res.end();
    });
    await listen(server, port);
    await expect(waitForHealth(`http://${HOST}:${port}`, 1)).rejects.toThrow(
      /last attempt: HTTP 503/,
    );
  });
});

describe("waitForPort", () => {
  it("resolves once something accepts connections", async () => {
    const port = await freePort(HOST);
    await listen(net.createServer(), port);
    await expect(waitForPort(port, HOST, 3)).resolves.toBeUndefined();
  });
});
