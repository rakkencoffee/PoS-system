const dotenv = require('dotenv');
dotenv.config();

async function debugKeys() {
  const appId = "AiXFMn0ipns8a8kS3IiJ";
  
  const keyUser = "lfFXUugNJkgYucuvDMSOhUmYdD5zPwKH"; // Hasil copas user (32 chars)
  const keyFix = "IfFXUugNJkgYucuvDMSOhuUmYdD5zPwKH";  // Hasil ekstraksi screenshot (33 chars)
  const apiBase = "https://api-open.olsera.co.id/api/open-api/v1/id/token";

  console.log("=== PERBANDINGAN KUNCI ===");
  console.log("Key User (Copas): ", keyUser, "(Length:", keyUser.length, ")");
  console.log("Key Fix (Screen): ", keyFix, "(Length:", keyFix.length, ")");
  console.log("--------------------------");

  async function test(label, secretKey) {
    console.log(`\nTesting ${label}...`);
    const formData = new FormData();
    formData.append('app_id', appId);
    formData.append('secret_key', secretKey);
    formData.append('grant_type', 'secret_key');

    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        body: formData,
      });
      const text = await res.text();
      console.log(`Status: ${res.status}`);
      console.log(`Result: ${text.substring(0, 100)}...`);
      return res.status;
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }

  await test("HASIL COPAS USER", keyUser);
  await test("HASIL SCREENSHOT (DENGAN 'u')", keyFix);
}

debugKeys();
