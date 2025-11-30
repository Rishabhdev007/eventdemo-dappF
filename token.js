// token.js — SIM token helper for EventDemo (ethers v6 UMD compatible)
//
// IMPORTANT: set TOKEN_ADDRESS to your SIM token *contract* address on Sepolia.
// Do NOT put your wallet address here.
const TOKEN_ADDRESS = "0xYour_SIM_TOKEN_CONTRACT_Address_here"; // <<--- REPLACE THIS

const MIN_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

(function () {
  if (window.simToken) return; // already installed

  let provider = null;
  let signer = null;
  let simContract = null;
  let simDecimals = 18;
  let initialized = false;

  async function makeProvider() {
    if (provider) return provider;
    // Prefer BrowserProvider if available, fallback to Web3Provider
    try {
      provider = (ethers && ethers.BrowserProvider) ? new ethers.BrowserProvider(window.ethereum) : new ethers.providers.Web3Provider(window.ethereum);
    } catch (e) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
    }
    return provider;
  }

  async function initReadonly() {
    if (initialized && simContract) return;
    if (!window.ethereum) throw new Error("MetaMask (window.ethereum) not found");
    await makeProvider();

    // Validate TOKEN_ADDRESS
    try {
      // ethers.getAddress is available in v6 UMD as ethers.getAddress
      if (typeof ethers.getAddress === "function") ethers.getAddress(TOKEN_ADDRESS);
    } catch (e) {
      console.error("TOKEN_ADDRESS invalid. Replace placeholder in token.js with real contract address.", e);
      throw e;
    }

    // Create read-only contract (provider only)
    const readProvider = provider;
    simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, readProvider);
    try { simDecimals = await simContract.decimals(); } catch (e) { simDecimals = 18; console.warn("Could not read decimals; defaulting to 18", e); }
    initialized = true;
  }

  async function ensureSigner() {
    // ensure signer available for write ops
    if (!signer) {
      await makeProvider();
      await provider.send("eth_requestAccounts", []); // will prompt if needed
      signer = await provider.getSigner();
    }
    // create contract with signer for writes
    if (!simContract) {
      simContract = new ethers.Contract(TOKEN_ADDRESS, MIN_ERC20_ABI, provider);
    }
    return signer;
  }

  async function getTokenInfo(addr) {
    try {
      await initReadonly();
      if (!addr) throw new Error("No address provided to getTokenInfo");
      const raw = await simContract.balanceOf(addr);
      const formatted = ethers.formatUnits(raw, simDecimals);
      let symbol = "SIM";
      try { symbol = await simContract.symbol(); } catch (e) {}
      return { raw, formatted, symbol, balance: formatted };
    } catch (err) {
      console.error("simToken.getTokenInfo error", err);
      throw err;
    }
  }

  async function transfer(to, amt) {
    try {
      if (!to || !amt) throw new Error("Missing to or amount");
      await ensureSigner();
      const contractWithSigner = simContract.connect(signer);
      const amountParsed = ethers.parseUnits(amt.toString(), simDecimals);
      const tx = await contractWithSigner.transfer(to, amountParsed);
      // Return tx object (user can wait)
      return tx;
    } catch (err) {
      console.error("simToken.transfer error", err);
      throw err;
    }
  }

  // Expose the public API
  window.simToken = {
    initReadonly,
    getTokenInfo,
    transfer,
    // helper to return decimals if needed
    getDecimals: () => simDecimals,
  };

  console.log("simToken helper installed");
})();
