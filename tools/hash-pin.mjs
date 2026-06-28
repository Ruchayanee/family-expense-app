const pin = process.argv[2];

if (!pin) {
  console.error("Usage: npm run hash:pin -- 123456");
  process.exit(1);
}

const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(pin)));
const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
console.log(hash);
