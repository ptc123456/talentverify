import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

async function run() {
  const contractAddress = process.env.VITE_GENLAYER_CONTRACT_ADDRESS;
  console.log("Studionet Smoke Test initialized...");
  console.log(`Contract Address Loaded: ${contractAddress || "undefined"}`);

  if (!contractAddress) {
    console.error("FAIL: VITE_GENLAYER_CONTRACT_ADDRESS is not defined in the environment");
    process.exit(1);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    console.error("FAIL: VITE_GENLAYER_CONTRACT_ADDRESS is not a valid 20-byte hex address");
    process.exit(1);
  }

  try {
    const client = createClient({
      chain: studionet,
    });

    console.log(`Connecting to RPC: ${studionet.rpcUrls.default.http[0]} (Chain ID: ${studionet.id})...`);
    
    console.log("Calling get_request_count()...");
    const count = await client.readContract({
      address: contractAddress,
      functionName: "get_request_count",
      args: [],
    });

    console.log(`Raw Returned Value: ${count} (type: ${typeof count})`);

    const countNum = Number(count);
    if (!Number.isInteger(countNum) || countNum < 0) {
      console.error(`FAIL: get_request_count returned invalid non-negative integer value: ${count}`);
      process.exit(1);
    }

    console.log("-----------------------------------------");
    console.log("SMOKE TEST RESULTS:");
    console.log(`Network: ${studionet.name}`);
    console.log(`RPC Endpoint: ${studionet.rpcUrls.default.http[0]}`);
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`Target Method: get_request_count`);
    console.log(`Execution Output: ${countNum}`);
    console.log("-----------------------------------------");
    console.log("PASS: Read-only Studionet smoke test passed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("FAIL: Read operation encountered an error:", err);
    process.exit(1);
  }
}

run();
