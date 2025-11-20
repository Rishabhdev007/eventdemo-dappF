
// app.js - EventDemo dApp logic

console.log("app.js loaded");

// Ensure ethers is available
if (typeof ethers === "undefined") {
    console.error("❌ ERROR: ethers is not loaded!");
}

// Contract ABI
const eventAbi = [
  "event ActionLogged(address indexed user, string message, uint256 timestamp)",
  "function ping() public",
  "function setMessage(string _msg) public",
  "function message() public view returns (string)"
];

// Normalize address
function normalize(addr) {
  try { return ethers.utils.getAddress(addr); }
  catch { return addr.toLowerCase(); }
}

(async function () {
  const addrEl = document.getElementById("contractAddr");
  let contractAddress = normalize(addrEl.innerText.trim());
  addrEl.innerText = contractAddress;

  const connectBtn = document.getElementById("connectBtn");
  const walletStatus = document.getElementById("walletStatus");
  const pingBtn = document.getElementById("pingBtn");
  const setMsgBtn = document.getElementById("setMsgBtn");
  const msgInput = document.getElementById("msgInput");
  const readMsgBtn = document.getElementById("readMsg");
  const eventsDiv = document.getElementById("events");

  let provider, signer, contract;

  function short(a) { return a.slice(0,6) + "..." + a.slice(-4); }

  async function attach() {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, eventAbi, signer);
  }

  async function connectWallet() {
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      await attach();
      const addr = await signer.getAddress();
      walletStatus.innerText = "Connected: " + short(addr);
      connectBtn.disabled = true;
    } catch (e) {
      console.error("Wallet connect error:", e);
    }
  }

  async function sendPing() {
    try {
      const tx = await contract.ping();
      await tx.wait();
      console.log("Ping sent!");
    } catch (e) {
      console.error("Ping error:", e);
    }
  }

  async function sendMessage() {
    let txt = msgInput.value.trim();
    if (!txt) return;
    try {
      const tx = await contract.setMessage(txt);
      await tx.wait();
      readMessage();
    } catch (e) {
      console.error("setMessage error:", e);
    }
  }

  async function readMessage() {
    try {
      const msg = await contract.message();
      document.getElementById("currentMessage").innerText = msg;
    } catch (e) {
      console.error("Read error:", e);
    }
  }

  connectBtn.onclick = connectWallet;
  pingBtn.onclick = sendPing;
  setMsgBtn.onclick = sendMessage;
  readMsgBtn.onclick = readMessage;

})();
