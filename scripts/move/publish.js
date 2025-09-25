require("dotenv").config();
const fs = require("node:fs");
const { spawn } = require("child_process");
const aptosSDK = require("@aptos-labs/ts-sdk");

async function runAptosCommand(args) {
  return new Promise((resolve, reject) => {
    console.log("Running command:", "npx aptos", args.join(" "));
    
    const child = spawn("npx", ["aptos", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output);
    });

    child.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function publish() {
  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
    );
  }

  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY variable is not set, make sure you have set the publisher account private key",
    );
  }

  try {
    console.log("Publishing contract...");
    
    const network = process.env.VITE_APP_NETWORK || "testnet";
    const privateKey = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.trim();
    const accountAddress = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS;
    const url = aptosSDK.NetworkToNodeAPI[network];

    // Build the command arguments
    // Use a different address name to avoid conflicts
    const args = [
      "move",
      "publish",
      "--package-dir", "contract",
      "--named-addresses", `message_board_addr=${accountAddress},revolv=${accountAddress}`,
      "--private-key", privateKey,
      "--url", url,
      "--assume-yes"
    ];

    const result = await runAptosCommand(args);
    
    // Extract object address from output
    // For regular publish command, modules are published to the account address
    const objectAddress = accountAddress;
    console.log("Contract published successfully!");
    console.log("Object Address:", objectAddress);

    // Update .env file with the new module address
    const filePath = ".env";
    let envContent = "";

    // Check .env file exists and read it
    if (fs.existsSync(filePath)) {
      envContent = fs.readFileSync(filePath, "utf8");
    }

    // Regular expression to match the VITE_MODULE_ADDRESS variable
    const regex = /^VITE_MODULE_ADDRESS=.*$/m;
    const newEntry = `VITE_MODULE_ADDRESS=${objectAddress}`;

    // Check if VITE_MODULE_ADDRESS is already defined
    if (envContent.match(regex)) {
      // If the variable exists, replace it with the new value
      envContent = envContent.replace(regex, newEntry);
    } else {
      // If the variable does not exist, append it
      envContent += `\n${newEntry}`;
    }

    // Write the updated content back to the .env file
    fs.writeFileSync(filePath, envContent, "utf8");
    console.log("Updated .env file with module address");

  } catch (error) {
    console.error("Error publishing contract:", error.message);
    throw error;
  }
}
publish();
