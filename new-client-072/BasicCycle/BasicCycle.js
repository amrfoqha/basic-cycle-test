const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const CFG = require("../config");

const loginTest = require("../login/loginTest");
const Roles = require("../data/Roles");
const CreateOrderTest = require("../CreateOrder/CreateOrderTest");

(async () => {
  const browser = await chromium.launch({
    headless: CFG.HEADLESS,
    slowMo: CFG.SLOW_MO,
  });

  const results = [];

  try {
    for (const role of Roles) {
      const roleStart = Date.now();
      const context = await browser.newContext();
      const page = await context.newPage();

      const roleResult = {
        roleName: role.roleName,
        success: false,
        error: null,
        loginMs: null,
        createMs: null,
        createTimings: null,
        totalMs: null,
      };

      try {
        // measure login
        const loginStart = Date.now();
        await loginTest(role, page);
        const loginEnd = Date.now();
        roleResult.loginMs = loginEnd - loginStart;

        // measure create order
        const createStart = Date.now();
        const createResult = await CreateOrderTest(role, page);
        const createEnd = Date.now();
        roleResult.createMs = createEnd - createStart;
        roleResult.createTimings = createResult.timings || null;

        roleResult.success = true;
        console.log(`✅ Finished create order for role: ${role.roleName}`);
      } catch (error) {
        roleResult.error =
          error && error.message ? error.message : String(error);
        console.log(`❌ Skipping role ${role.roleName}: ${roleResult.error}`);
      } finally {
        await context.close();
        roleResult.totalMs = Date.now() - roleStart;
        results.push(roleResult);
      }
    }

    // aggregate statistics
    const summary = {
      runAt: new Date().toISOString(),
      totalRoles: results.length,
      successes: results.filter((r) => r.success).length,
      failures: results.filter((r) => !r.success).length,
      perRole: results,
    };

    // compute averages for login and create (only for successes with values)
    const successfulLoginMs = results
      .map((r) => r.loginMs)
      .filter((v) => typeof v === "number");
    const successfulCreateMs = results
      .map((r) => r.createMs)
      .filter((v) => typeof v === "number");

    const avg = (arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    summary.avgLoginMs = Math.round(avg(successfulLoginMs));
    summary.avgCreateMs = Math.round(avg(successfulCreateMs));

    // min/max
    summary.minLoginMs = successfulLoginMs.length
      ? Math.min(...successfulLoginMs)
      : null;
    summary.maxLoginMs = successfulLoginMs.length
      ? Math.max(...successfulLoginMs)
      : null;
    summary.minCreateMs = successfulCreateMs.length
      ? Math.min(...successfulCreateMs)
      : null;
    summary.maxCreateMs = successfulCreateMs.length
      ? Math.max(...successfulCreateMs)
      : null;

    console.log("\n=== Basic Cycle Performance Summary ===");
    console.log(`Run at: ${summary.runAt}`);
    console.log(`Total roles: ${summary.totalRoles}`);
    console.log(`Successes: ${summary.successes}`);
    console.log(`Failures: ${summary.failures}`);
    console.log(`Avg login (ms): ${summary.avgLoginMs}`);
    console.log(`Avg create (ms): ${summary.avgCreateMs}`);
    console.log(
      `Min/Max login (ms): ${summary.minLoginMs}/${summary.maxLoginMs}`
    );
    console.log(
      `Min/Max create (ms): ${summary.minCreateMs}/${summary.maxCreateMs}`
    );

    // write JSON report next to this file
    try {
      const outPath = path.join(__dirname, "basic-cycle-perf.json");
      fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
      console.log(`Performance report written to ${outPath}`);
    } catch (writeErr) {
      console.error("Failed to write performance report:", writeErr);
    }

    // Also produce a simple statistics file and concise console output
    try {
      const simple = results.map((r) => ({
        roleName: r.roleName,
        success: r.success,
        totalMs: r.totalMs,
        loginMs: r.loginMs,
        createMs: r.createMs,
      }));

      const simpleOut = {
        runAt: summary.runAt,
        totalRoles: summary.totalRoles,
        successes: summary.successes,
        failures: summary.failures,
        avgTotalMs: Math.round(
          results.reduce((a, b) => a + (b.totalMs || 0), 0) /
            (results.length || 1)
        ),
        perRole: simple,
      };

      const simplePath = path.join(__dirname, "basic-cycle-perf-simple.json");
      fs.writeFileSync(simplePath, JSON.stringify(simpleOut, null, 2), "utf8");
      console.log(`Simple performance report written to ${simplePath}`);

      console.log("\n=== Simple Per-Role Stats ===");
      simple.forEach((r) => {
        console.log(
          `${r.roleName}: ${r.success ? "OK" : "FAIL"} total=${
            r.totalMs
          }ms login=${r.loginMs}ms create=${r.createMs}ms`
        );
      });

      console.log(`Avg total per role (ms): ${simpleOut.avgTotalMs}`);
    } catch (e) {
      console.error("Failed to write simple performance report:", e);
    }
  } finally {
    await browser.close();
  }
})();
