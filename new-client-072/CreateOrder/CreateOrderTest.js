const { chromium } = require("playwright");
const { generateReference } = require("./GenerateReference.js");

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://new-client-072.olivery.app/web/login");
  await page.getByRole("textbox", { name: "Email" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("admin");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill("admin");
  await page.getByRole("button", { name: "Log in" }).click();
  // the end of the login process

  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("textbox", { name: "Reference Reference Id" }).click();
  await page
    .getByRole("textbox", { name: "Reference Reference Id" })
    .fill(generateReference());
  await page.getByRole("textbox", { name: "Sender" }).click();
  await page.locator("#ui-id-26").getByText("oliver").click();
  await page.getByRole("textbox", { name: "Customer Name" }).click();
  await page.getByRole("textbox", { name: "Customer Name" }).fill("test");
  await page.getByRole("textbox", { name: "Full Address" }).click();
  await page.locator("#ui-id-43").getByText("اريحا - اريحا").click();
  await page.getByRole("textbox", { name: "Customer Address" }).click();
  await page.getByRole("textbox", { name: "Customer Address" }).fill("test");
  await page.getByRole("textbox", { name: "First Customer Mobile" }).click();
  await page
    .getByRole("textbox", { name: "First Customer Mobile" })
    .fill("0987654321");
  await page
    .locator("div")
    .filter({ hasText: /^Cost$/ })
    .click();
  await page.getByRole("textbox", { name: "Total Amount" }).click();
  await page.getByRole("textbox", { name: "Total Amount" }).fill("120");
  await page.getByText("Order Details").click();
  await page.getByRole("button", { name: "Save" }).click();

  // ---------------------
  await context.close();
  await browser.close();
})();
