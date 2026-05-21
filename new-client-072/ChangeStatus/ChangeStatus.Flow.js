const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const Roles = require("../data/Roles");
const loginTest = require("../login/loginTest");
const CreateOrderTest = require("../CreateOrder/CreateOrderTest");
const BaseUrl = require("../BaseUrl/BaseUrl");
const CFG = (() => require("../config"))();

const screenshotsDir = path.join(__dirname, "..", "change-status-screenshots");

try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
} catch (e) {}

// -----------------------------
// Select first order checkbox
// -----------------------------
async function selectFirstOrder(page) {
  const checkbox = page
    .locator("td input.custom-control-input[type='checkbox'][id^='checkbox-']")
    .first();

  await checkbox.waitFor({
    state: "attached",
    timeout: 15000,
  });

  const row = checkbox.locator("xpath=ancestor::tr[1]");

  await row.waitFor({
    state: "visible",
    timeout: 15000,
  });

  if (!(await checkbox.isChecked())) {
    await checkbox.check({ force: true });
  }

  console.log("✅ First order selected");

  return row;
}

// -----------------------------
// Open Change State dialog
// -----------------------------
async function openChangeStateDialog(page) {
  const changeStateBtn = page.locator(
    "button.oe_action_button_change_state.is-visible"
  );

  await changeStateBtn.waitFor({
    state: "visible",
    timeout: 15000,
  });

  await changeStateBtn.scrollIntoViewIfNeeded();
  await changeStateBtn.click({ force: true });

  await page.locator(".modal, .o_dialog").first().waitFor({
    state: "visible",
    timeout: 15000,
  });

  console.log("✅ Change State dialog opened");
}

// -----------------------------
// Select canceled status
// -----------------------------
async function selectCancelledStatus(page) {
  const statusSelect = page.getByLabel("Status");

  await statusSelect.waitFor({
    state: "visible",
    timeout: 10000,
  });

  await statusSelect.selectOption('"canceled"');

  console.log("✅ Status selected: canceled");
}

// -----------------------------
// Save state dialog
// -----------------------------
async function saveStateDialog(page) {
  const saveBtn = page.getByRole("button", { name: "Save" });

  await saveBtn.waitFor({
    state: "visible",
    timeout: 10000,
  });

  await saveBtn.click();

  const confirmDialog = page
    .locator(".modal, .o_dialog")
    .filter({
      hasText: /Confirmation Message|Confirm/i,
    })
    .last();

  await confirmDialog.waitFor({
    state: "visible",
    timeout: 15000,
  });

  await confirmDialog.getByRole("button", { name: /^Confirm$/ }).waitFor({
    state: "visible",
    timeout: 15000,
  });

  console.log("✅ Confirmation dialog opened");
}

// -----------------------------
// Confirm cancel and wait for Odoo RPC
// -----------------------------
async function confirmCancel(page) {
  const confirmDialog = page
    .locator(".modal, .o_dialog")
    .filter({
      hasText: /Confirmation Message|Confirm/i,
    })
    .last();

  await confirmDialog.waitFor({
    state: "visible",
    timeout: 15000,
  });

  const confirmBtn = confirmDialog.getByRole("button", {
    name: /^Confirm$/,
  });

  await confirmBtn.waitFor({
    state: "visible",
    timeout: 10000,
  });

  const callButtonPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/web/dataset/call_button") &&
      response.request().method() === "POST" &&
      response.status() === 200,
    { timeout: 20000 }
  );

  const searchReadPromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/web/dataset/search_read") &&
        response.request().method() === "POST" &&
        response.status() === 200,
      { timeout: 20000 }
    )
    .catch(() => null);

  await confirmBtn.click({ force: true });

  const callButtonResponse = await callButtonPromise;

  if (!callButtonResponse.ok()) {
    throw new Error(
      `Confirm request failed. Status: ${callButtonResponse.status()}`
    );
  }

  const json = await callButtonResponse.json().catch(() => null);

  if (json?.error) {
    throw new Error(json.error.message || "Odoo returned confirm error");
  }

  await searchReadPromise;

  await confirmDialog
    .waitFor({
      state: "hidden",
      timeout: 15000,
    })
    .catch(() => {});

  await page.waitForTimeout(1000);

  console.log("✅ Confirm clicked and Odoo refreshed list");
}
async function searchOnRefID(page, orderCreated) {
  const reference = orderCreated.reference;

  const searchBox = page.getByRole("searchbox", { name: "Search..." });

  await searchBox.waitFor({ state: "visible", timeout: 10000 });
  await searchBox.click();

  await searchBox.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await searchBox.press("Backspace");

  await searchBox.pressSequentially(reference, { delay: 100 });

  const searchOption = page
    .locator(".o_searchview_autocomplete li, .ui-menu-item, a")
    .filter({
      hasText: /Search Reference Id for:/i,
    })
    .first();

  try {
    await searchOption.waitFor({
      state: "visible",
      timeout: 5000,
    });

    await searchOption.click();
  } catch (error) {
    await searchBox.press("Enter");
  }

  await page.waitForTimeout(1500);

  await page.getByRole("cell", { name: orderCreated.reference }).waitFor({
    state: "visible",
    timeout: 15000,
  });

  return true;
}
async function changeFirstOrderToCancelled(page, role, orderCreated) {
  await page.waitForTimeout(1500);

  await searchOnRefID(page, orderCreated);
  await selectFirstOrder(page);

  await openChangeStateDialog(page);

  await selectCancelledStatus(page);

  await saveStateDialog(page);

  await confirmCancel(page);

  await page.screenshot({
    path: path.join(
      screenshotsDir,
      `change-status-success-${role.roleName}.png`
    ),
    fullPage: true,
  });

  return {
    success: true,
    roleName: role.roleName,
    status: "canceled",
  };
}

(async () => {
  const browser = await chromium.launch({
    headless: CFG.HEADLESS,
    slowMo: CFG.SLOW_MO,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const business = Roles.find(
    (r) => r.roleName === "business" || r.username === "olivery_bs"
  );

  if (!business) {
    throw new Error("Business role not found in Roles.js");
  }

  try {
    await loginTest(business, page);
    const orderCreated = await CreateOrderTest(business, page);
    const result = await changeFirstOrderToCancelled(
      page,
      business,
      orderCreated
    );

    console.log("✅ Flow completed successfully");
    console.log(orderCreated.reference);
  } catch (error) {
    console.log("❌ Flow failed:", error.message);

    await page.screenshot({
      path: path.join(screenshotsDir, "change-status-error.png"),
      fullPage: true,
    });

    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
})();
