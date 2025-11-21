// --- START: Safe SIM balance / token helper (ethers v6) ---
// Make sure to include ethers v6 in your HTML (index.html):
// <script type="module" src="https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.min.js"></script>

// Using your SIM token address:
const TOKEN_ADDRESS = "0xFd65C5871955aaDcd34955980eC9F28aA52378Ab"; // SIM token contract (Sepolia)
const MIN_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

let provider, signer, userAddress, simContract;
let initialized = false;
let simDecimals = 18;

async function initWalletAndContract() {
  try {
    if (!window.ethereum) throw new Error("No Web3 wallet found (window.ethereum is undefined)");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    // validate address checksum
    try { ethers.getAddress(TOKEN_ADDRESS); } catch (e) { throw new Error("Bad token address (checksum). Update TOKEN_ADDRESS."); }

    // create contract instance (provider for reads)
    simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);

    // read decimals/symbol if available
    try { simDecimals = await simContract.decimals(); } catch (e) { simDecimals = 18; console.warn("decimals() failed, defaulting to 18"); }
    try { const sym = await simContract.symbol(); console.log("Token symbol:", sym); } catch (e) {}

    initialized = true;
    console.log("initWalletAndContract OK", { userAddress, token: TOKEN_ADDRESS, decimals: simDecimals });
    return { userAddress, token: TOKEN_ADDRESS, decimals: simDecimals };
  } catch (err) {
    console.error("initWalletAndContract error:", err);
    throw err;
  }
}

async function getTokenInfo(address) {
  if (!initialized || !simContract) throw new Error("Contract not initialized. Call initWalletAndContract() first.");
  const raw = await simContract.balanceOf(address);
  const formatted = ethers.formatUnits(raw, simDecimals);
  let symbol = "SIM";
  try { symbol = await simContract.symbol(); } catch (e) {}
  return { raw, formatted, decimals: simDecimals, symbol };
}

async function sendSim(toAddress, amountHuman) {
  if (!initialized) await initWalletAndContract();
  const contractWithSigner = simContract.connect(signer);
  const amountParsed = ethers.parseUnits(amountHuman.toString(), simDecimals);
  const tx = await contractWithSigner.transfer(toAddress, amountParsed);
  console.log("Sent SIM tx hash:", tx.hash);
  await tx.wait();
  console.log("Send SIM tx mined:", tx.hash);
  return tx;
}

// UI wiring - adjust selectors if your HTML uses different ids/names
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect") || document.getElementById("connect-wallet");
  const showSimBalanceBtn = document.getElementById("show-sim-balance") || document.querySelector("button#showSimBalance") || document.querySelector("button");
  const balanceEl = document.getElementById("sim-balance") || document.querySelector("#sim-balance");
  const sendBtn = document.querySelector("button#send-sim") || document.querySelector("button[name='sendSim']");
  const toInput = document.querySelector("input[name='toAddress']") || document.querySelector("input#sim-to");
  const amountInput = document.querySelector("input[name='simAmount']") || document.querySelector("input#sim-amount");
  const holderInput = document.querySelector("input#sim-holder") || document.querySelector("input[name='holder']");

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
    initWalletAndContract().catch(e => console.log("Auto init failed (click Connect Wallet):", e.message));
  }

  if (showSimBalanceBtn) {
    showSimBalanceBtn.addEventListener("click", async () => {
      try {
        if (!initialized) await initWalletAndContract();
        const holder = (holderInput && holderInput.value && holderInput.value.trim()) ? holderInput.value.trim() : userAddress;
        const info = await getTokenInfo(holder);
        console.log("SIM token info:", info);
        if (balanceEl) balanceEl.innerText = `${info.formatted} ${info.symbol}`;
        else alert(`Balance: ${info.formatted} ${info.symbol}`);
      } catch (err) {
        console.error("SIM balance error", err);
        alert("Error fetching SIM balance (see console)");
      }
    });
  } else {
    console.warn("Show SIM Balance button not found (selector mismatch).");
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      try {
        if (!initialized) await initWalletAndContract();
        const to = (toInput && toInput.value.trim()) ? toInput.value.trim() : null;
        const amount = (amountInput && amountInput.value.trim()) ? amountInput.value.trim() : null;
        if (!to || !amount) return alert("Enter recipient address and amount.");
        const tx = await sendSim(to, amount);
        alert("Sent SIM, tx: " + tx.hash);
      } catch (e) {
        console.error("sendSim error", e);
        alert("Error sending SIM (see console)");
      }
    });
  }
});
// --- END: Safe SIM balance / token helper ---
