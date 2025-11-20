
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

    // SIM Token Controls
const showSimBalanceBtn = document.getElementById("showSimBalanceBtn");
const simBalanceEl = document.getElementById("simBalance");
const sendSimBtn = document.getElementById("sendSimBtn");

showSimBalanceBtn.onclick = async () => {
  try {
    const address = await signer.getAddress();
    const info = await window.simToken.getTokenInfo(address);
    simBalanceEl.innerText = info.balance;
  } catch(err) {
    console.error("SIM balance error", err);
    alert("Error fetching SIM balance (see console)");
  }
};

sendSimBtn.onclick = async () => {
  try {
    const to = document.getElementById("simRecipient").value.trim();
    const amt = document.getElementById("simAmount").value.trim();
    
    if (!to || !amt) {
      alert("Enter recipient + amount");
      return;
    }
    
    const tx = await window.simToken.sendTokens(to, amt);
    alert("SIM sent! Tx: " + tx.hash);
  } catch(err) {
    console.error("SIM send failed", err);
    alert("Sending SIM failed (see console)");
  }
};

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
    // SIM UI elements
const showSimBalanceBtn = document.getElementById('showSimBalanceBtn');
const sendSimBtn = document.getElementById('sendSimBtn');
const simRecipientInput = document.getElementById('simRecipient');
const simAmountInput = document.getElementById('simAmount');

// Handler: show SIM balance for connected account
if (showSimBalanceBtn) {
  showSimBalanceBtn.onclick = async () => {
    try {
      // ensure wallet connected
      if (!signer) {
        await connectWallet();
      }
      const addr = await signer.getAddress();
      // token helper must exist (token.js)
      if (window.simToken && typeof window.simToken.getTokenInfo === 'function') {
        const info = await window.simToken.getTokenInfo(addr);
        const balEl = document.getElementById('simBalance');
        if (balEl) balEl.innerText = `${info.balance} ${info.symbol || 'SIM'}`;
      } else {
        alert('Token helper (token.js) not loaded or missing simToken.getTokenInfo.');
        console.error('simToken helper missing', window.simToken);
      }
    } catch (err) {
      console.error('Show SIM balance error', err);
      alert('Error fetching SIM balance (see console)');
    }
  };
}

// Handler: send SIM using token.js helper
if (sendSimBtn) {
  sendSimBtn.onclick = async () => {
    try {
      if (!signer) {
        await connectWallet();
      }
      const to = (simRecipientInput && simRecipientInput.value) ? simRecipientInput.value.trim() : '';
      const amt = (simAmountInput && simAmountInput.value) ? simAmountInput.value.trim() : '';
      if (!to || !amt) return alert('Enter recipient address and amount');

      if (!window.simToken || typeof window.simToken.sendTokens !== 'function') {
        return alert('Token helper (token.js) not loaded or missing sendTokens().');
      }

      // call sendTokens which uses signer + token contract
      const tx = await window.simToken.sendTokens(to, amt);
      alert('Transaction submitted: ' + tx.hash);
      // optionally wait for confirmation:
      // const receipt = await tx.wait(); alert('Confirmed: ' + receipt.transactionHash);
    } catch (err) {
      console.error('Send SIM error', err);
      alert('Failed to send SIM (see console)');
    }
  };
}


})();
