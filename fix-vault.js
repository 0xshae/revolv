require("dotenv").config();
const { spawn } = require("child_process");

async function fixVault() {
  console.log("Attempting to fix vault state...");
  
  // Try to call a function that might reset the state
  const args = [
    "move",
    "run",
    "--function-id", "0xba5123fded6eff1f2f4aeaa3ef11efb1ececd404bc61b30d2e5277e031cef762::revolv_vault::claim_fees",
    "--args", "u64:0",
    "--private-key", process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.trim(),
    "--url", "https://api.testnet.aptoslabs.com/v1",
    "--assume-yes"
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["aptos", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Vault fix attempted successfully");
        resolve({ stdout, stderr });
      } else {
        console.log("Vault fix failed, but this might be expected");
        resolve({ stdout, stderr });
      }
    });
  });
}

fixVault().catch(console.error);
