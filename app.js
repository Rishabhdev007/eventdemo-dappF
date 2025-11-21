// ------------------- SIM TOKEN SETTINGS -------------------
const TOKEN_ADDRESS = "0xFd65C5871955aaDcd34955980eC9F28aA52378Ab"; // SIM on Sepolia

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

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  console.log("Connected wallet:", userAddress);

  ethers.getAddress(TOKEN_ADDRESS); // validate address

  simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);

  try { simDecimals = await simContract.decimals(); }
  catch { simDecimals = 18; }

  try { console.log("Token symbol:", await simContract.symbol()); }
  catch {}

  initialized = true;
  return true;
}


// ------------------- READ SIM BALANCE -------------------
async function getTokenInfo(holder) {
  if (!initialized) await initWalletAndContract();

  const raw = await simContract.balanceOf(holder);
  const formatted = ethers.formatUnits(raw, simDecimals);

  let symbol = "SIM";
  try { symbol = await simContract.symbol(); } catch {}

  return { raw, formatted, symbol };
}


// ------------------- SEND SIM TOKENS -------------------
async function sendSim(toAddress, amountHuman) {
  if (!initialized) await initWalletAndContract();

  if (!toAddress || !amountHuman) throw new Error("Missing address or amount");

  const myAddr = await signer.getAddress();
  if (myAddr.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
    throw new Error("Cannot send from contract address. Switch wallet.");
  }

  const contractWithSigner = simContract.connect(signer);
  const amountParsed = ethers.parseUnits(amountHuman.toString(), simDecimals);

  console.log("Sending SIM:", amountHuman, "to", toAddress);

  const tx = await contractWithSigner.transfer(toAddress, amountParsed);
  alert("Transaction sent: " + tx.hash);

  await tx.wait();
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

  // CONNECT WALLET
  connectBtn.addEventListener("click", async () => {
    try {
      await initWalletAndContract();
      alert("Wallet connected: " + userAddress);
    } catch (err) {
      console.error(err);
      alert("Wallet error: " + err.message);
    }
  });


  // SHOW SIM BALANCE
  showBalanceBtn.addEventListener("click", async () => {
    try {
      await initWalletAndContract();
      const info = await getTokenInfo(userAddress);
      balanceEl.innerText = `${info.formatted} ${info.symbol}`;
      console.log("SIM Balance:", info);
    } catch (err) {
      console.error("Balance error:", err);
      alert("Error reading balance");
    }
  });


  // SEND SIM TOKENS
  sendBtn.addEventListener("click", async () => {
    try {
      const to = toInput.value.trim();
      const amt = amtInput.value.trim();

      if (!to || !amt) return alert("Enter recipient & amount!");

      const tx = await sendSim(to, amt);
      alert("SIM Sent! Tx: " + tx.hash);

    } catch (err) {
      console.error("sendSim error:", err);
      alert("Error: " + err.message);
    }
  });

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
