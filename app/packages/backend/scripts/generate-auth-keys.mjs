#!/usr/bin/env node
/**
 * Generates the RS256 key pair Convex Auth needs and sets JWT_PRIVATE_KEY, JWKS and SITE_URL
 * on the current Convex deployment (the one in .env.local / CONVEX_DEPLOYMENT).
 *
 *   pnpm --filter @drink/backend setup:auth                # SITE_URL=http://localhost:3000
 *   pnpm --filter @drink/backend setup:auth https://book.drink.co.ke
 *   pnpm --filter @drink/backend setup:auth -- --print     # only print, don't set
 */
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const args = process.argv.slice(2).filter((a) => a !== "--");
const printOnly = args.includes("--print");
const siteUrl = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });

const vars = { JWT_PRIVATE_KEY: privateKey, JWKS: jwks, SITE_URL: siteUrl };
if (printOnly) {
  for (const [k, v] of Object.entries(vars)) console.log(`${k}="${v}"`);
} else {
  for (const [k, v] of Object.entries(vars)) {
    execFileSync("npx", ["convex", "env", "set", "--", k, v], { stdio: ["ignore", "ignore", "inherit"], env: process.env });
    console.log(`✓ set ${k}`);
  }
}
