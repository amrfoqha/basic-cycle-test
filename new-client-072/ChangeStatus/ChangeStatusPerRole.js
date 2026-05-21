const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const Roles = require("../data/Roles");
const RolesFlow = require("../data/Roles.Flow");
const loginTest = require("../login/loginTest");
const CreateOrderTest = require("../CreateOrder/CreateOrderTest");
const BaseUrl = require("../BaseUrl/BaseUrl");
const changeStatusFlow = require("./ChangeStatus.Flow");
const { ifError } = require("assert");
const CFG = (() => require("../config"))();

const screenshotsDir = path.join(__dirname, "..", "change-status-screenshots");

try {
  fs.mkdirSync(screenshotsDir, { recursive: true });
} catch (e) {}
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
async function selectStatus(page, status, role) {
  const statusSelect = page.getByLabel("Status");

  await statusSelect.waitFor({
    state: "visible",
    timeout: 10000,
  });

  await statusSelect.selectOption(status);

  console.log(`✅ Status selected: ${status}`);

  // -------------------------
  // In Branch
  // -------------------------
  if (status === "In Branch") {
    const currentBranchInput = page.getByRole("textbox", {
      name: "Current Branch",
    });

    const isBranchVisible = await currentBranchInput.isVisible({
      timeout: 5000,
    });
    await currentBranchInput.click();
    await page.waitForTimeout(500);
    await currentBranchInput.press("Enter");

    console.log("✅ Current Branch selected");
  }

  // -------------------------
  // In Progress / Delivered
  // -------------------------
  if (status === "In Progress" || status === "Delivered") {
    await page.waitForTimeout(500);
    const agentInput = page.getByRole("textbox", { name: "Agent" });

    const isAgentVisible = await agentInput
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isAgentVisible) {
      await agentInput.click();
      await agentInput.fill("olivery_dr");

      await page.waitForTimeout(500);

      await clickExactAutocompleteOption(page, "olivery_dr");

      console.log("✅ Agent selected exactly: olivery_dr");
    } else {
      console.log("⚠️ Agent field not visible, skipping agent selection");

      await page.screenshot({
        path: `../change-status-screenshots/change-status-no-agent-field-${role.roleName}.png`,
        fullPage: true,
      });
    }
  }
}
async function clickExactAutocompleteOption(page, exactText) {
  const options = page.locator(".ui-menu-item:visible");

  await options.first().waitFor({
    state: "visible",
    timeout: 10000,
  });

  const count = await options.count();

  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const text = (await option.innerText()).trim();

    if (text === exactText) {
      await option.click();
      return;
    }
  }

  throw new Error(`Exact autocomplete option not found: ${exactText}`);
}
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
async function confirm(page) {
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
async function changeFirstOrderToStatus(page, role, orderCreated, status) {
  await page.waitForTimeout(1500);

  await searchOnRefID(page, orderCreated);
  await selectFirstOrder(page);

  await openChangeStateDialog(page);

  await selectStatus(page, status);

  await saveStateDialog(page);

  await confirm(page);

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

async function changeStatusPerRole() {
  const browser = await chromium.launch({
    headless: CFG.HEADLESS,
    slowMo: CFG.SLOW_MO,
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  const BusinessRole = Roles.find((r) => r.roleName === "business");
  console.log(BusinessRole);
  await loginTest(BusinessRole, page);
  const orderCreated = await CreateOrderTest(BusinessRole, page);

  try {
    for (const role of RolesFlow) {
      await loginTest(role, page);
      const result = await changeFirstOrderToStatus(
        page,
        role,
        orderCreated,
        role.status
      );

      console.log("✅ Flow completed successfully");
      console.log(orderCreated.reference);
    }
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
}

module.exports = changeStatusPerRole;
