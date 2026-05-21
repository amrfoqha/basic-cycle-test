const { expect } = require("playwright");
const { generateReference } = require("./GenerateReference.js");
const BaseUrl = require("../BaseUrl/BaseUrl.js");

async function saveOrderAndVerify(page) {
  const saveBtn = page.locator("button.o_form_button_save");
  const editBtn = page.locator("button.o_form_button_edit");

  const errorDialog = page.locator(
    ".modal:has-text('Validation Error'), .modal:has-text('Access Error'), .modal:has-text('Error'), .o_error_dialog"
  );

  const dangerNotification = page.locator(
    ".o_notification_manager .alert-danger, .o_notification_manager .bg-danger"
  );

  await saveBtn.waitFor({ state: "visible", timeout: 10000 });

  const saveResponsePromise = page.waitForResponse(
    async (response) => {
      if (!response.url().includes("/web/dataset/call_kw")) return false;
      if (response.request().method() !== "POST") return false;

      const postData = response.request().postData() || "";

      return (
        postData.includes("rb_delivery.order") &&
        (postData.includes('"create"') || postData.includes('"write"'))
      );
    },
    { timeout: 20000 }
  );

  await saveBtn.click();

  const response = await saveResponsePromise;
  const json = await response.json().catch(() => null);

  if (!response.ok()) {
    throw new Error(`Save request failed. Status: ${response.status()}`);
  }

  if (json?.error) {
    throw new Error(json.error.message || "Odoo returned save error");
  }

  const result = await Promise.race([
    editBtn.waitFor({ state: "visible", timeout: 15000 }).then(() => "success"),
    errorDialog
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => "error-dialog"),
    dangerNotification
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => "danger-notification"),
  ]);

  if (result !== "success") {
    throw new Error(`Order save failed: ${result}`);
  }

  const url = page.url();
  const hash = url.split("#")[1] || "";
  const params = new URLSearchParams(hash);
  const recordId = params.get("id");

  return {
    success: true,
    recordId,
    rpcResult: json?.result,
    url,
  };
}

async function assertOrderCreatedFromIframe(page) {
  const frame = page.frameLocator("iframe");
  const successDiv = frame.locator(".static-buttons-container");

  try {
    await successDiv.waitFor({
      state: "visible",
      timeout: 15000,
    });

    console.log("✅ Order created successfully - success div is visible");
    return true;
  } catch (error) {
    await page.screenshot({
      path: "../create-order-screenshots/order-created-not-created.png",
      fullPage: true,
    });

    throw new Error("Order creation failed: success div is not visible");
  }
}

async function normalCreate(role, page) {
  const reference = generateReference();

  await page
    .getByRole("textbox", { name: "Reference Reference Id" })
    .fill(reference);

  await page.getByRole("textbox", { name: "Sender" }).click();

  await page
    .locator(".ui-menu-item", { hasText: "olivery_bs" })
    .first()
    .click();

  await page.getByRole("textbox", { name: "Customer Name" }).fill("test");

  const fullAddress = page.getByRole("textbox", { name: "Full Address" });

  await fullAddress.waitFor({ state: "visible", timeout: 15000 });
  await fullAddress.click();

  await fullAddress.fill("اريحا");

  const firstOption = page.locator(".ui-menu-item:visible").first();

  await firstOption.waitFor({ state: "visible", timeout: 15000 });
  await firstOption.click();
  await page.getByRole("textbox", { name: "Customer Address" }).fill("test");

  await page
    .getByRole("textbox", { name: "First Customer Mobile" })
    .fill("0987654321");
  await page
    .locator("div")
    .filter({ hasText: /^Cost$/ })
    .click();

  await page.getByRole("textbox", { name: "Total Amount" }).fill("120");

  await page.getByText("Order Details").click();

  const result = await saveOrderAndVerify(page);

  console.log("✅ Normal order created successfully");
  console.log("Role:", role.roleName);
  console.log("Reference:", reference);
  console.log("Record ID:", result.recordId);

  await page.screenshot({
    path: `../create-order-screenshots/order-created-successfully-${role.roleName}.png`,
    fullPage: true,
  });

  return {
    success: true,
    type: "normal",
    roleName: role.roleName,
    reference,
    recordId: result.recordId,
    url: result.url,
  };
}

async function quickCreate(role, page) {
  const reference = generateReference();
  const frame = page.frameLocator("iframe");

  await page.locator("div.custom-dialog").first().waitFor({
    state: "visible",
    timeout: 15000,
  });

  await frame.locator("#REFERENCE_ID").fill(reference);

  await frame.locator('[id="4024"]').getByRole("button").click();
  await frame.getByText("olivery_bs").click();

  await frame.locator("#CUSTOMER_NAME").fill("test");

  await frame.locator("#mat-input-3").click();
  await frame
    .getByRole("option", { name: "اللبن الشرقي", exact: true })
    .click();

  await frame.locator("#CUSTOMER_ADDRESS").fill("test");
  await frame.locator("#CUSTOMER_MOBILE").fill("0987654321");
  await frame.locator("#NOTE").fill("test");
  await frame.locator("#TOTAL_AMOUNT").fill("120");

  const createBtn = frame.locator(
    "button.mat-mdc-raised-button:has(img[src*='thunder.svg'])"
  );

  await createBtn.waitFor({ state: "visible", timeout: 10000 });
  await createBtn.scrollIntoViewIfNeeded();
  await createBtn.click({ force: true });

  await assertOrderCreatedFromIframe(page);

  await page
    .locator("body")
    .getByRole("button", { name: "X", exact: true })
    .click();

  console.log("✅ Quick order created successfully");
  console.log("Role:", role.roleName);
  console.log("Reference:", reference);

  await page.screenshot({
    path: `../create-order-screenshots/quick-order-created-successfully-${role.roleName}.png`,
    fullPage: true,
  });

  return {
    success: true,
    type: "quick",
    roleName: role.roleName,
    reference,
  };
}

async function CreateOrderTest(role, page) {
  try {
    await page.goto(
      `https://${BaseUrl}.olivery.app/web#action=177&model=rb_delivery.order&view_type=list&menu_id=96`,
      { waitUntil: "domcontentloaded" }
    );

    await page.waitForTimeout(1000);

    const addButton = page.locator("button.o_list_button_add").first();

    const quickOrderButton = page
      .locator("button.oe_action_button_quick_order")
      .first();

    const buttonType = await Promise.race([
      addButton
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => "normal")
        .catch(() => null),

      quickOrderButton
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => "quick")
        .catch(() => null),
    ]);

    let createResult;

    if (buttonType === "normal") {
      await addButton.click();
      console.log("✅ Normal create button clicked");

      createResult = await normalCreate(role, page);
    } else if (buttonType === "quick") {
      await quickOrderButton.click({ force: true });
      console.log("✅ Quick order button clicked");

      createResult = await quickCreate(role, page);
    } else {
      throw new Error("No create button found");
    }

    return {
      success: true,
      roleName: role.roleName,
      type: createResult.type,
      reference: createResult.reference,
      recordId: createResult.recordId || null,
      url: createResult.url || null,
    };
  } catch (error) {
    console.log(
      `❌ Create order failed for role ${role.roleName}: ${error.message}`
    );

    await page.screenshot({
      path: `../create-order-screenshots/order-create-failed-${role.roleName}.png`,
      fullPage: true,
    });

    throw error;
  }
}
module.exports = CreateOrderTest;
