import localtunnel from "localtunnel";

async function start() {
  const tunnel = await localtunnel({ port: 3001, subdomain: "qadha" });
  console.log("========================================");
  console.log("YOUR PUBLIC GAME URL:");
  console.log(tunnel.url);
  console.log("========================================");
  tunnel.on("close", () => {
    console.log("Tunnel closed, restarting...");
    setTimeout(start, 3000);
  });
  tunnel.on("error", (err) => {
    console.error("Tunnel error:", err.message);
    setTimeout(start, 3000);
  });
}
start();
