const loginTest = require("../login/loginTest");
const Roles = require("../data/Roles");

(async () => {
  for (const role of Roles) {
    await loginTest(role);
  }
})();
