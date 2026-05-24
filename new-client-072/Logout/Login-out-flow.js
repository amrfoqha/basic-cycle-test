const { chromium } = require("playwright");

const loginTest = require("../login/loginTest");
const logoutTest = require("./logout.automation");
const CFG = require("../config");
const Roles = require("../data/Roles");

(async () => {
  const browser = await chromium.launch({
    headless: CFG.HEADLESS,
    slowMo: CFG.SLOW_MO,
  });

  try {
    for (const role of Roles) {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await loginTest(role, page);
        await logoutTest(role, page);
      } catch (error) {
        console.log(`❌ Role failed ${role.roleName}: ${error.message}`);

        await page
          .screenshot({
            path: `../logout-screenshots/login-logout-failed-${role.roleName}.png`,
            fullPage: true,
          })
          .catch(() => {});
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }
})();