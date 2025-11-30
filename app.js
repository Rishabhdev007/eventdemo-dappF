// app.js — main dApp logic (separate file). Uses ethers v6 UMD and window.simToken.

document.addEventListener("DOMContentLoaded", () => {
  const debugEl = document.getElementById("debug");
  const log = (...args) => { try { debugEl.textContent += "\n" + args.join(" "); } catch(e){}; console.log(...args); };

  const abi = [
    "event ActionLogged(address indexed user,string message,uint256 timestamp)",
    "function ping() public",
    "function setMessage(string) public",
    "function message() view returns (string)"
  ];

  const contractAddrEl = document.getElementById("contractAddr");
  let contractAddress = (contractAddrEl && contractAddrEl.innerText) ? contractAddrEl.innerText.trim() : "";
  try { if (ethers.getAddress) contractAddress = ethers.getAddress(contractAddress); } catch(e) { /* keep original */ }

  let provider, signer, contract;

  // DOM refs
  const connectBtn = document.getElementById("connect");
  const walletStatus = document.getElementById("walletStatus");
  const msgInput = document.getElementById("msgInput");
  const currentMessageEl = document.getElementById("currentMessage");
  const eventsDiv = document.getElementById("events");
  const simBalanceEl = document.getElementById("sim-balance");

  // Provider loader (robust)
  async function loadProvider() {
    if (provider && contract) return;
    if (!window.ethereum) throw new Error("MetaMask (window.ethereum) missing");
    if (ethers.BrowserProvider) {
      provider = new ethers.BrowserProvider(window.ethereum);
      log("Using BrowserProvider");
    } else if (ethers.providers && ethers.providers.Web3Provider) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      log("Using providers.Web3Provider");
    } else if (ethers.Web3Provider) {
      provider = new ethers.Web3Provider(window.ethereum);
      log("Using ethers.Web3Provider (fallback)");
    } else {
      throw new Error("No compatible ethers provider constructor found");
    }
    contract = new ethers.Contract(contractAddress, abi, provider);
  }

  // Connect wallet
  async function connectWallet() {
    try {
      await loadProvider();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      signer = await provider.getSigner();
      walletStatus.innerText = "Connected: " + accounts[0];
      log("Connected", accounts[0]);
      await readMessage();
      await fetchEvents();
      listenEvents();
      await updateSimBalance(accounts[0]);
      connectBtn.disabled = true;
      connectBtn.innerText = "Connected";
    } catch (e) {
      console.error("connectWallet error", e);
      log("connectWallet error", e.message || e);
      alert("Connect failed: " + (e.message || e));
    }
  }

  // Read on-chain message (provider-backed contract)
  async function readMessage() {
    try {
      await loadProvider();
      const m = await contract.message();
      currentMessageEl.innerText = m || "(empty)";
      log("readMessage:", m);
    } catch (e) {
      console.error("readMessage error", e);
      log("readMessage error", e.message || e);
    }
  }

  // Write message (connect signer)
  async function setMessage() {
    try {
      await loadProvider();
      if (!signer) signer = await provider.getSigner();
      const writeContract = contract.connect(signer);
      const val = msgInput.value.trim();
      if (!val) return alert("Enter a message");
      const tx = await writeContract.setMessage(val);
      log("setMessage tx sent:", tx.hash);
      await tx.wait();
      log("setMessage mined:", tx.hash);
      await readMessage();
      // update SIM balance after action (in case)
      const addr = window.ethereum.selectedAddress || (signer ? await signer.getAddress() : null);
      if (addr) await updateSimBalance(addr);
    } catch (e) {
      console.error("setMessage error", e);
      alert("setMessage failed: " + (e.message || e));
    }
  }

  // ping()
  async function ping() {
    try {
      await loadProvider();
      if (!signer) signer = await provider.getSigner();
      const writeContract = contract.connect(signer);
      const tx = await writeContract.ping();
      log("ping tx:", tx.hash);
      await tx.wait();
      log("ping mined:", tx.hash);
    } catch (e) {
      console.error("ping error", e);
      alert("ping failed: " + (e.message || e));
    }
  }

  // Fetch past events (safe)
  async function fetchEvents() {
    try {
      await loadProvide
