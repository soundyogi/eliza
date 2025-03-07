import net from "net";

// Utility function to check if a port is available.
export const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
};

export const wait = (minTime = 1000, maxTime = 3000): Promise<void> => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise(resolve => setTimeout(resolve, waitTime));
};