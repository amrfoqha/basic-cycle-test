const fs = require("fs");
const path = require("path");
const CFG = require("../config");

const screenshotsDir = path.join(__dirname, "..", "logout-screenshots");

try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
} catch (e) {
  console.error("[logoutTest] Could not create screenshots directory:", e);
}

async function assertLoggedOut(page) {
  await page.locator("form.oe_login_form").waitFor({
    state: "visible",
    timeout: 15000,
  });

  await page.locator("input#login[name='login']").waitFor({
    state: "visible",
    timeout: 10000,
  });

  await page.locator("input#password[name='password']").waitFor({
    state: "visible",
    timeout: 10000,
  });

  await page.locator("button.log-in-btn[type='submit']").waitFor({
    state: "visible",
    timeout: 10000,
  });

  return true;
}

async function logoutTest(role, page) {
  try {
    console.log(`➡️ Logging out role: ${role.roleName}`);

    const userMenu = page.locator(".o_user_menu").first();

    await userMenu.waitFor({
      state: "visible",
      timeout: CFG.TIMEOUT_SHORT || 10000,
    });

    await userMenu.click();

    const logoutBtn = page
      .locator("a, button, .dropdown-item")
      .filter({ hasText: /^Log out$/i })
      .first();

    await logoutBtn.waitFor({
      state: "visible",
      timeout: CFG.TIMEOUT_SHORT || 10000,
    });

    await logoutBtn.click();

    await assertLoggedOut(page);

    console.log(`✅ Logout success: ${role.roleName}`);

    return {
      success: true,
      roleName: role.roleName,
    };
  } catch (error) {
    await page
      .screenshot({
        path: path.join(screenshotsDir, `${role.roleName}-failed.png`),
        fullPage: true,
      })
      .catch(() => {});

    console.log(`❌ Logout failed: ${role.roleName} -> ${error.message}`);

    throw error;
  }
}

module.exports = logoutTest;