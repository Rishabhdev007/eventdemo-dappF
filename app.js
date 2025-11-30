// app.js — PATCHED FULL FILE
// ------------------- SIM TOKEN SETTINGS -------------------
// IMPORTANT: Put your SIM token *contract* address here (Sepolia).
// Do NOT use your wallet address here.
const TOKEN_ADDRESS = "0xYour_SIM_TOKEN_CONTRACT_Address_here"; // <<--- REPLACE THIS

const MIN_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

let provider, signer, userAddress, simContract;
let simDecimals = 18;
let initialized = false;


// ------------------- INIT WALLET + CONTRACT -------------------
async function initWalletAndContract() {
  if (!window.ethereum) {
    alert("No MetaMask found!");
    throw new Error("MetaMask missing");
  }

  // If already initialized, optionally refresh signer/provider
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
  } catch (e) {
    // Older ethers builds or if BrowserProvider not available, fallback:
    provider = new ethers.providers.Web3Provider(window.ethereum);
  }

  // Request accounts (prompts MetaMask if locked)
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  let rawAddr = await signer.getAddress();

  // Normalize to checksum display if possible
  try {
    userAddress = ethers.getAddress(rawAddr.trim());
  } catch (e) {
    userAddress = rawAddr.trim();
  }

  console.log("Connected wallet (display):", userAddress);
  // Set a global helper for older code paths
  window.userAccount = userAddress;

  // Validate token address (must be a valid address)
  try {
    ethers.getAddress(TOKEN_ADDRESS);
  } catch (e) {
    console.error("TOKEN_ADDRESS invalid. Set TOKEN_ADDRESS to your SIM token contract address (Sepolia).", e);
    alert("SIM token contract address not set or invalid. Check TOKEN_ADDRESS in app.js.");
    throw e;
  }

  // Create a read-only contract (provider). For writes we'll connect signer later.
  simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);

  // Read token decimals and symbol (safe)
  try { simDecimals = await simContract.decimals(); } catch (e) { simDecimals = 18; console.warn("decimals read failed, defaulting to 18", e); }
  try { console.log("Token symbol:", await simContract.symbol()); } catch (e) { /* ignore */ }

  initialized = true;
  return true;
}


// ------------------- READ SIM BALANCE -------------------
async function getTokenInfo(holder) {
  if (!initialized) await initWalletAndContract();

  if (!holder) throw new Error("No holder address provided to getTokenInfo");

  // We accept checksum or lower-case addresses; contract call will accept both
  const raw = await simContract.balanceOf(holder);
  const formatted = ethers.formatUnits(raw, simDecimals);

  let symbol = "SIM";
  try { symbol = await simContract.symbol(); } catch (e) { /* fallback */ }

  return { raw, formatted, symbol };
}


// ------------------- SEND SIM TOKENS -------------------
async function sendSim(toAddress, amountHuman) {
  if (!initialized) await initWalletAndContract();

  if (!toAddress || !amountHuman) throw new Error("Missing toAddress or amount");

  // Sender address from signer
  const myAddr = await signer.getAddress();

  // Defensive check: TOKEN_ADDRESS should not equal sender address
  if (myAddr.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
    throw new Error("TOKEN_ADDRESS equals your wallet address — check app config.");
  }

  // Connect contract with signer for write operations
  const contractWithSigner = simContract.connect(signer);

  // parse units (works with ethers v6)
  const amountParsed = ethers.parseUnits(amountHuman.toString(), simDecimals);

  console.log("Sending SIM:", amountHuman, "to", toAddress, "from", myAddr);

  // Submit transaction
  const tx = await contractWithSigner.transfer(toAddress, amountParsed);

  // Inform the user non-blockingly
  alert("Transaction sent: " + tx.hash);
  console.log("Transaction sent, waiting for confirmation:", tx.hash);

  await tx.wait(); // wait for mined
  console.log("Transaction mined:", tx.hash);

  return tx;
}


// ------------------- UI HANDLERS -------------------
document.addEventListener("DOMContentLoaded", () => {

  const connectBtn = document.getElementById("connect");
  const showBalanceBtn = document.getElementById("show-sim-balance");
  const balanceEl = document.getElementById("sim-balance");
  const sendBtn = document.getElementById("send-sim");
  const toInput = document.getElementById("sim-to");
  const amtInput = document.getElementById("sim-amount");

  // Optional: elements used for showing address/status if present in your HTML
  const addrDisplay = document.getElementById("wallet-address") || document.getElementById("walletAddress") || document.getElementById("walletAddressDisplay");
  const statusDisplay = document.getElementById("connectStatus") || document.getElementById("status");

  // CONNECT WALLET
  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {
      try {
        await initWalletAndContract();
        // update UI
        if (addrDisplay) addrDisplay.innerText = userAddress;
        if (statusDisplay) statusDisplay.innerText = "Connected";
        alert("Wallet connected: " + userAddress);
      } catch (err) {
        console.error(err);
        alert("Wallet error: " + (err.message || err));
      }
    });
  }

  // SHOW SIM BALANCE
  if (showBalanceBtn) {
    showBalanceBtn.addEventListener("click", async () => {
      try {
        // Ensure wallet & contract ready; this won't re-prompt if already connected
        if (!initialized) await initWalletAndContract();

        // Use userAddress if set, otherwise ask provider for accounts silently
        let holder = window.userAccount || (await window.ethereum.request({ method: 'eth_accounts' }))[0];
        if (!holder) {
          // fallback to connect flow
          await initWalletAndContract();
          holder = window.userAccount;
        }

        const info = await getTokenInfo(holder);
        if (balanceEl) balanceEl.innerText = `${info.formatted} ${info.symbol}`;
        console.log("SIM Balance:", info);
      } catch (err) {
        console.error("Balance error:", err);
        alert("Error reading balance: " + (err.message || err));
        if (balanceEl) balanceEl.innerText = "Error";
      }
    });
  }

  // SEND SIM TOKENS
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      try {
        const to = toInput.value.trim();
        const amt = amtInput.value.trim();

        if (!to || !amt) return alert("Enter recipient & amount!");

        // ensure initialized
        if (!initialized) await initWalletAndContract();

        const tx = await sendSim(to, amt);
        alert("SIM Sent! Tx: " + tx.hash);

      } catch (err) {
        console.error("sendSim error:", err);
        alert("Error: " + (err.message || err));
      }
    });
  }

});


// ------------------- COMPATIBILITY SHIM -------------------
(function () {
  if (window.tokenHelper) return;

  async function ensureInit() {
    if (!initialized) await initWalletAndContract();
  }

  window.tokenHelper = {
    async getTokenInfo(addr) {
      await ensureInit();
      return await getTokenInfo(addr);
    },

    async getBalance(addr) {
      return await this.getTokenInfo(addr);
    },

    async transfer(to, amt) {
      await ensureInit();
      return await sendSim(to, amt);
    }
  };

  console.log("tokenHelper shim installed");
})();
