/**
 * Renders the lock-in-access email to a static HTML file and prints
 * the text version, so Paul can eyeball the proof before sending.
 *
 * Usage: npx tsx scripts/preview-lock-in-email.ts
 */
import {
  renderLockInAccessEmail,
  LOCK_IN_ACCESS_SUBJECT,
} from "../src/lib/announcements/lockInAccess";
import { writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_HTML = "/tmp/lock-in-preview.html";
const OUTPUT_TXT = "/tmp/lock-in-preview.txt";

const { html, text } = renderLockInAccessEmail({
  recipientName: "Tony",
  unsubscribeUrl: "https://www.autoqc.io/unsubscribe?token=preview",
});

writeFileSync(OUTPUT_HTML, html);
writeFileSync(OUTPUT_TXT, text);

console.log(`Subject: ${LOCK_IN_ACCESS_SUBJECT}`);
console.log(`HTML proof: ${OUTPUT_HTML}`);
console.log(`Text proof: ${OUTPUT_TXT}`);
console.log();
console.log("--- TEXT VERSION ---");
console.log(text);
