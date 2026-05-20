const { chromium } = require("playwright");

const loginTest = require("../login/loginTest");
const Roles = require("../data/Roles");
const CreateOrderTest = require("../CreateOrder/CreateOrderTest");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  try {
    for (const role of Roles) {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await loginTest(role, page);

        await CreateOrderTest(role, page);

        console.log(`✅ Finished create order for role: ${role.roleName}`);
      } catch (error) {
        console.log(`❌ Skipping role ${role.roleName}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})();
