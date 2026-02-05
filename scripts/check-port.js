#!/usr/bin/env node
"use strict";
/**
 * Fail fast if the given port is in use. Used by apps/web and apps/api dev scripts.
 * Usage: node scripts/check-port.js <port>
 * Exit 0 if port is free; exit 1 with message if port is in use.
 */
const net = require("net");
const port = parseInt(process.argv[2], 10);
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error("Usage: node scripts/check-port.js <port>");
  process.exit(1);
}
const server = net.createServer();
server.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Free it or choose another.`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
server.once("listening", () => {
  server.close();
});
server.listen(port, "127.0.0.1");
