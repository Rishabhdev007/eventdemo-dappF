// --- START: Safe SIM balance / token helper (ethers v6) ---
// Make sure to include ethers v6 in your HTML: 
// <script type="module" src="https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.min.js"></script>

const TOKEN_ADDRESS = "0xYourTokenAddressHere"; // <-- paste your SIM token address
const MIN_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

let provider, signer, userAddress, simContract;
let initialized = false;

async function initWalletAndContract() {
  try {
    if (!window.ethereum) throw new Error("No Web3 wallet found (window.ethereum is undefined)");
    // request accounts and create provider/signer
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    // validate address
    try { ethers.getAddress(TOKEN_ADDRESS); } catch (e) { throw new Error("Bad token address. Paste the deployed token address (checksum) into TOKEN_ADDRESS"); }

    // create contract instance (read-only via provider is ok for balanceOf)
    simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);

    initialized = true;
    console.log("INIT: provider, signer, simContract ready for", userAddress);
  } catch (err) {
    console.error("initWalletAndContract error:", err);
    throw err;
  }
}

// helper: returns { rawBalance, formatted, symbol, decimals }
async function getTokenInfo(address) {
  if (!initialized || !simContract) throw new Error("Contract not initialized. Call initWalletAndContract() first.");
  const raw = await simContract.balanceOf(address);
  let decimals = 18;
  try { decimals = await simContract.decimals(); } catch (e) { console.warn("decimals() call failed, defaulting to 18"); }
  let symbol = "SIM";
  try { symbol = await simContract.symbol(); } catch (e) { /* ignore */ }
  const formatted = ethers.formatUnits(raw, decimals);
  return { raw, formatted, decimals, symbol };
}

// Wire up UI safely
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect") || document.getElementById("connect-wallet");
  const showSimBalanceBtn = document.getElementById("show-sim-balance") || document.querySelector("button#showSimBalance") || document.querySelector("button");

  // connect button optional: initialize on connect
  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {
      try {
        await initWalletAndContract();
        alert("Wallet connected: " + userAddress);
      } catch (e) {
        alert("Wallet/connect error: " + (e.message || e));
      }
    });
  } else {
    // if no explicit connect button, try to init once (but catch errors)
    initWalletAndContract().catch(e => console.warn("Auto-init failed (call Connect Wallet):", e.message));
  }

  if (!showSimBalanceBtn) {
    console.warn("showSimBalance button not found — make sure button has id='show-sim-balance' or matches selector.");
    return;
  }

  showSimBalanceBtn.addEventListener("click", async () => {
    try {
      // ensure init completed
      if (!initialized) {
        await initWalletAndContract();
      }
      const info = await getTokenInfo(userAddress);
      console.log("SIM token info:", info);
      // update DOM elements (adjust ids to your markup)
      const balanceEl = document.getElementById("sim-balance") || document.querySelector("#sim-balance");
      if (balanceEl) balanceEl.innerText = `${info.formatted} ${info.symbol}`;
      else alert(`Balance: ${info.formatted} ${info.symbol}`);
    } catch (err) {
      console.error("SIM balance error", err);
      alert("Error fetching SIM balance (see console)");
    }
  });
});
// --- END ---
