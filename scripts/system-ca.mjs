// Opt-in for managed machines whose HTTPS inspection CA is already trusted by
// the operating system. Never disable TLS or import a certificate from a server.
import tls from "node:tls";

if (typeof tls.getCACertificates !== "function" || typeof tls.setDefaultCACertificates !== "function") {
  throw new Error("System CA support requires Node.js 22.19+ or 24.5+. Use a current Node.js release.");
}

tls.setDefaultCACertificates([
  ...new Set([...tls.getCACertificates("default"), ...tls.getCACertificates("system")]),
]);
