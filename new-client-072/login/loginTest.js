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
const BaseUrl = require("../BaseUrl/BaseUrl");
const CFG = require("../config");

// ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, "..", "login-screenshots");

try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
} catch (e) {
  console.error("[loginTest] Could not create screenshots directory:", e);
}

async function changeLanguageToEnglish(page) {
  const languageBtn = page.locator("a.language_icon[aria-label='Languages']");

  await languageBtn.waitFor({ state: "visible", timeout: CFG.TIMEOUT_SHORT });
  await languageBtn.click();

  const englishOption = page
    .locator(".dropdown-menu a", { hasText: "English" })
    .first();

  await englishOption.waitFor({ state: "visible", timeout: CFG.TIMEOUT_SHORT });
  await englishOption.click();

  await page.waitForLoadState("domcontentloaded").catch(() => {});
}

async function waitLoginResult(page) {
  const navbar = page.locator("nav.o_main_navbar");
  const errorMsg = page.locator("p.alert.alert-danger");

  const loginBtn = page.locator("form button.log-in-btn[type='submit']");

  await loginBtn.waitFor({ state: "visible", timeout: CFG.TIMEOUT_SHORT });
  await loginBtn.click({ force: true });

  try {
    const result = await Promise.race([
      navbar
        .waitFor({ state: "visible", timeout: CFG.TIMEOUT_MEDIUM })
        .then(() => ({
          success: true,
        })),

      errorMsg
        .waitFor({ state: "visible", timeout: CFG.TIMEOUT_MEDIUM })
        .then(async () => ({
          success: false,
          error: (await errorMsg.innerText()).trim(),
        })),
    ]);

    return result;
  } catch (error) {
    throw new Error(
      "Login result timeout: neither navbar nor error message appeared"
    );
  }
}

async function loginTest(role, page) {
  try {
    console.log(`\n➡️ Testing role: ${role.roleName}`);

    await page.goto(`https://${BaseUrl}.olivery.app/web/login`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(CFG.TIMEOUT_TINY);
    await page.getByRole("textbox", { name: "Email" }).fill(role.username);
    await page.getByRole("textbox", { name: "Password" }).fill(role.password);

    const result = await waitLoginResult(page);

    if (!result.success) {
      throw new Error(result.error || "Wrong login/password");
    }

    await changeLanguageToEnglish(page);

    await page.setDefaultTimeout(10000);

    await page.getByRole("button", { name: "Orders" }).click();
    await page.getByRole("menuitem", { name: "Active Orders" }).click();

    console.log(`✅ Login success: ${role.roleName}`);

    return {
      success: true,
      roleName: role.roleName,
    };
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

    // ✅ important: rethrow the real error
    throw error;
  }
}

module.exports = loginTest;
