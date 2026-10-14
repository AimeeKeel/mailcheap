import { register } from "node:module";

// Lets tests import server actions and route handlers as they are: the @/ alias resolves, and Next.js
// request APIs, QStash, SES, DNS lookups (domain checks and imports' mail domains), the DNS helper, Vercel Blob,
// S3, CloudFront, image downloads and client metadata documents are replaced by the stubs in tests/stubs.
register("./hooks.mjs", import.meta.url);
