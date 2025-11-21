// --- START: Safe SIM balance / token helper (ethers v6) ---
// Make sure to include ethers v6 in your HTML (index.html):
// <script src="https://cdn.jsdelivr.net/npm/ethers@6.8.0/dist/ethers.umd.min.js"></script>

// SIM token address you deployed:
const TOKEN_ADDRESS = "0xFd65C5871955aaDcd34955980eC9F28aA52378Ab"; // SIM token contract (Sepolia)

// Minimal ERC20 ABI
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

    // validate SIM token address
    ethers.getAddress(TOKEN_ADDRESS);

    // Initialize contract
    simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);

    try { simDecimals = await simContract.decimals(); } catch (e) { simDecimals = 18; }
    try { const sym = await simContract.symbol(); console.log("Token symbol:", sym); } catch (e) {}

    initialized = true;
    console.log("initWalletAndContract OK", { userAddress, token: TOKEN_ADDRESS, decimals: simDecimals });
  } catch (err) {
    console.error("initWalletAndContract error:", err);
    throw err;
  }
}

async function getTokenInfo(address) {
  if (!initialized) await initWalletAndContract();
  const raw = await simContract.balanceOf(address);
  const formatted = ethers.formatUnits(raw, simDecimals);
  let symbol = "SIM";
  try { symbol = await simContract.symbol(); } catch (e) {}
  return { raw, formatted, symbol, decimals: simDecimals };
}

async function sendSim(toAddress, amountHuman) {
  if (!initialized) await initWalletAndContract();
  const contractWithSigner = simContract.connect(signer);
  const amountParsed = ethers.parseUnits(amountHuman.toString(), simDecimals);
  const tx = await contractWithSigner.transfer(toAddress, amountParsed);
  await tx.wait();
  console.log("Send SIM tx mined:", tx.hash);
  return tx;
}

// --- UI WIRING ---
document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect");
  const showSimBalanceBtn = document.getElementById("show-sim-balance");
  const balanceEl = document.getElementById("sim-balance");
  const sendBtn = document.getElementById("send-sim");
  const toInput = document.getElementById("sim-to");
  const amountInput = document.getElementById("sim-amount");

  connectBtn?.addEventListener("click", async () => {
    try {
      await initWalletAndContract();
      alert("Wallet connected: " + userAddress);
    } catch (e) {
      alert("Error connecting wallet: " + (e.message || e));
    }
  });

  showSimBalanceBtn?.addEventListener("click", async () => {
    try {
      if (!initialized) await initWalletAndContract();
      const info = await getTokenInfo(userAddress);
      balanceEl.innerText = `${info.formatted} ${info.symbol}`;
    } catch (err) {
      console.error("SIM balance error", err);
      alert("Error fetching SIM balance");
    }
  });

  sendBtn?.addEventListener("click", async () => {
    try {
      const to = toInput.value.trim();
      const amount = amountInput.value.trim();
      if (!to || !amount) return alert("Enter address + amount");
      const tx = await sendSim(to, amount);
      alert("SIM sent. Tx: " + tx.hash);
    } catch (e) {
      console.error("sendSim error", e);
      alert("Error sending SIM");
    }
  });

}); 
// --- END SIM HELPER ---

// --- START: Compatibility shim (fixes “token helper missing SIM”) ---
(function(){
  if (window.tokenHelper) {
    console.log("tokenHelper already present");
    return;
  }

  async function ensureInit() {
    if (!initialized) {
      if (typeof initWalletAndContract === "function") {
        await initWalletAndContract();
      }
    }
  }

  window.tokenHelper = {
    async getTokenInfo(address) {
      await ensureInit();
      return await getTokenInfo(address);
    },

    async getBalance(address) {
      return await this.getTokenInfo(address);
    },

    async transfer(to, amount) {
      await ensureInit();
      return await sendSim(to, amount);
    }
  };

  console.log("Compatibility shim installed (tokenHelper ready)");
})();
// --- END shim ---
