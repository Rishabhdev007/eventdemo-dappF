
// app.js - EventDemo DApp logic (patched to show SIM balance after connect)
// Uses ethers v5 UMD (window.ethers) and token.js helper exposing window.simToken

(async function(){
  // ABI & initial values
  const abi = [
    "event ActionLogged(address indexed user, string message, uint256 timestamp)",
    "function ping() public",
    "function setMessage(string _msg) public",
    "function message() public view returns (string)"
  ];

  // DOM elements
  const contractAddrEl = document.getElementById('contractAddr');
  let contractAddressRaw = (contractAddrEl && contractAddrEl.innerText) ? contractAddrEl.innerText.trim() : '';
  if (!contractAddressRaw) {
    console.error('No contract address found in #contractAddr');
    contractAddressRaw = '';
  }

  // Normalize & validate using ethers.utils.getAddress()
  let contractAddress;
  try {
    contractAddress = ethers.utils.getAddress(contractAddressRaw);
    contractAddrEl.innerText = contractAddress; // show checksummed
  } catch (err) {
    console.warn('Address checksum invalid or mixed-case. Falling back to lowercase and attempting to normalize. Original:', contractAddressRaw);
    const lower = contractAddressRaw.toLowerCase();
    try {
      contractAddress = ethers.utils.getAddress(lower);
      contractAddrEl.innerText = contractAddress;
    } catch (err2) {
      console.error('Address still invalid after lowercasing. Using lowercase string as-is:', err2);
      contractAddress = lower; // last resort
    }
  }

  let provider, signer, contract;

  const connectBtn = document.getElementById('connectBtn');
  const walletStatus = document.getElementById('walletStatus');
  const pingBtn = document.getElementById('pingBtn');
  const setMsgBtn = document.getElementById('setMsgBtn');
  const msgInput = document.getElementById('msgInput');
  const eventsDiv = document.getElementById('events');
  const readMsgBtn = document.getElementById('readMsg');
  const refreshEventsBtn = document.getElementById('refreshEvents');
  const clearEventsBtn = document.getElementById('clearEvents');
  const debugPre = document.getElementById('debug');
  // new SIM balance element (ensure index.html has <span id="simBalance">-</span>)
  const simBalanceEl = document.getElementById('simBalance');

  function short(a){ return a ? (a.slice(0,6) + "..." + a.slice(-4)) : '(no addr)'; }
  function logDebug(...args){
    try{
      console.log(...args);
      debugPre.innerText += '\\n' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      debugPre.scrollTop = debugPre.scrollHeight;
    }catch(e){}
  }

  function toast(msg){
    try{
      const t = document.createElement('div');
      t.style.position='fixed'; t.style.right='16px'; t.style.bottom='16px'; t.style.zIndex=999999;
      t.style.background='rgba(0,0,0,0.85)'; t.style.color='white'; t.style.padding='10px 12px'; t.style.borderRadius='8px';
      t.style.boxShadow='0 6px 18px rgba(0,0,0,0.2)'; t.textContent = msg; document.body.appendChild(t);
      setTimeout(()=> t.style.opacity='0',3500); setTimeout(()=> t.remove(),4200);
    }catch(e){}
  }

  function addEventObj(e){
    const el = document.createElement('div');
    el.className = 'evt';
    const time = new Date(Number(e.timestamp)*1000).toLocaleString();
    el.innerHTML = `<div><strong>${e.message}</strong></div><div class="small">by ${short(e.user)} • ${time}</div>`;
    eventsDiv.prepend(el);
  }

  async function attach(){
    if (!window.ethereum) throw new Error('MetaMask not found (window.ethereum missing).');
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);
    logDebug('attach: provider & contract ready', contractAddress);
  }

  // NEW: update SIM balance UI using token.js helper
  async function updateSimBalance(address) {
    try {
      if (!simBalanceEl) return;
      if (window.simToken && typeof window.simToken.getTokenInfo === 'function') {
        const info = await window.simToken.getTokenInfo(address);
        simBalanceEl.innerText = `${info.balance} ${info.symbol}`;
      } else {
        simBalanceEl.innerText = 'token helper missing';
      }
    } catch (e) {
      console.error('updateSimBalance error', e);
      simBalanceEl && (simBalanceEl.innerText = 'error');
    }
  }

  async function connectWallet(){
    try{
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await attach();
      walletStatus.innerText = 'Connected: ' + short(accounts[0]);
      connectBtn.innerText = 'Connected';
      connectBtn.disabled = true;
      await readCurrentMessage();
      await fetchPastEvents();
      listenEvents();
      // update SIM balance right after connect
      await updateSimBalance(accounts[0]);
      logDebug('Connected', accounts[0]);
    } catch(e){
      console.error('connectWallet error ->', e);
      logDebug('connectWallet error ->', e.message || e);
      toast('MetaMask connection failed (see console)');
    }
  }

  async function sendPing(){
    try{
      const tx = await contract.ping();
      const receipt = await tx.wait();
      toast('Ping tx: ' + receipt.transactionHash);
      logDebug('ping tx', receipt.transactionHash);
    }catch(e){
      console.error('sendPing error ->', e);
      toast('Ping failed (see console)');
    }
  }

  async function doSetMessage(){
    const txt = msgInput.value.trim();
    if(!txt){ toast('Enter a message first!'); return; }
    try{
      const tx = await contract.setMessage(txt);
      const receipt = await tx.wait();
      toast('setMessage tx: ' + receipt.transactionHash);
      msgInput.value = '';
      await readCurrentMessage();
      // refresh SIM balance (in case msg triggers token transfer in other contracts)
      if (window.ethereum && window.ethereum.selectedAddress) {
        try { await updateSimBalance(window.ethereum.selectedAddress); } catch(e){}
      }
      logDebug('setMessage tx', receipt.transactionHash);
    }catch(e){
      console.error('doSetMessage error ->', e);
      if (e && e.code === 'INVALID_ARGUMENT' && /checksum/i.test(String(e.message))) {
        toast('Contract address checksum invalid - see console');
      } else {
        toast('setMessage failed (see console)');
      }
    }
  }

  async function readCurrentMessage(){
    try{
      const m = await contract.message();
      document.getElementById('currentMessage').innerText = m || '(empty)';
    }catch(e){
      console.error('readCurrentMessage error ->', e);
      toast('Read message failed (see console)');
    }
  }

  async function fetchPastEvents(){
    try{
      const iface = new ethers.utils.Interface(abi);
      const topic = iface.getEventTopic('ActionLogged');
      const filter = { address: contractAddress, topics: [topic] };
      const logs = await provider.getLogs(filter);
      for(const log of logs.reverse()){
        const parsed = iface.parseLog(log);
        addEventObj({ user: parsed.args.user, message: parsed.args.message, timestamp: parsed.args.timestamp.toString() });
      }
    }catch(e){
      console.error('fetchPastEvents error ->', e);
      toast('Fetching events failed (see console)');
    }
  }

  function listenEvents(){
    try {
      contract.on('ActionLogged', (user, message, timestamp) => {
        addEventObj({ user, message, timestamp: timestamp.toString() });
      });
    } catch (e) {
      console.error('listenEvents error ->', e);
    }
  }

  // wire up buttons
  connectBtn.onclick = connectWallet;
  pingBtn.onclick = sendPing;
  setMsgBtn.onclick = doSetMessage;
  readMsgBtn.onclick = readCurrentMessage;
  refreshEventsBtn.onclick = () => { eventsDiv.innerHTML = ''; fetchPastEvents(); };
  clearEventsBtn.onclick = () => { eventsDiv.innerHTML = ''; };

  // attempt silent attach if already connected
  if (window.ethereum && window.ethereum.selectedAddress) {
    try {
      await attach();
      walletStatus.innerText = 'Connected (silent): ' + short(window.ethereum.selectedAddress);
      connectBtn.innerText = 'Connected';
      connectBtn.disabled = true;
      await readCurrentMessage();
      fetchPastEvents();
      listenEvents();
      // also update sim balance silently
      try { await updateSimBalance(window.ethereum.selectedAddress); } catch(e){}
      logDebug('Auto-attached to provider', window.ethereum.selectedAddress);
    } catch (e) {
      // ignore
    }
  }

})();
