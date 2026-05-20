// Startup log and global error handlers to surface silent failures
console.log("[loginTest] starting script");
process.on("uncaughtException", (err) => {
  console.error(
    "[loginTest] UncaughtException:",
    err && err.stack ? err.stack : err
  );
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[loginTest] UnhandledRejection:", reason);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const Roles = require("../data/roles");

// ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, "..", "screenshots");
try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
} catch (e) {
  console.error("[loginTest] Could not create screenshots directory:", e);
}

async function waitLoginResult(page) {
  const navbar = page.locator("nav.o_main_navbar");
  const errorMsg = page.locator("p.alert.alert-danger");

  await page.locator("form button:has-text('Log in')").click({ force: true });
  return await Promise.race([
    navbar.waitFor({ state: "visible", timeout: 15000 }).then(() => ({
      success: true,
    })),
    errorMsg.waitFor({ state: "visible", timeout: 15000 }).then(() => ({
      success: false,
      error: "Wrong login/password",
    })),
  ]);
}

async function loginTest(role) {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50, // يساعدك في debugging
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`\n➡️ Testing role: ${role.roleName}`);

    await page.goto("https://new-client-072.olivery.app/web/login", {
      waitUntil: "domcontentloaded",
    });

    await page.getByRole("textbox", { name: "Email" }).fill(role.username);
    await page.getByRole("textbox", { name: "Password" }).fill(role.password);

    const result = await waitLoginResult(page);

    if (!result.success) {
      throw new Error(result.error);
    }

    // ✅ FINAL ASSERT (double safety)
    await page.locator("nav.o_main_navbar").waitFor({
      state: "visible",
      timeout: 10000,
    });

    //   await page.screenshot({
    //     path: path.join(screenshotsDir, `${role.roleName}.png`),
    //     fullPage: true,
    //   });

    console.log(`✅ Login success: ${role.roleName}`);
  } catch (error) {
    try {
      await page.screenshot({
        path: path.join(screenshotsDir, `${role.roleName}-failed.png`),
        fullPage: true,
      });
    } catch (screenshotErr) {
      console.error("[loginTest] Screenshot failed:", screenshotErr);
    }

    console.log(`❌ Login failed: ${role.roleName} -> ${error.message}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = loginTest;
