// app.js — EventDemo DApp logic (patched to show SIM balance after connect)
// Uses ethers UMD loaded in index.html

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

  // Normalize & validate using ethers.getAddress (v6)
  let contractAddress;
  try {
    contractAddress = (typeof ethers.getAddress === 'function') ? ethers.getAddress(contractAddressRaw) : contractAddressRaw;
    if (contractAddrEl) contractAddrEl.innerText = contractAddress;
  } catch (err) {
    console.warn('Address checksum invalid or mixed-case. Using provided string:', contractAddressRaw);
    contractAddress = contractAddressRaw;
  }

  let provider, signer, contract;

  const connectBtn = document.getElementById('connect');
  const walletStatus = document.getElementById('walletStatus');
  const pingBtn = document.getElementById('pingBtn');
  const setMsgBtn = document.getElementById('setMsgBtn');
  const msgInput = document.getElementById('msgInput');
  const eventsDiv = document.getElementById('events');
  const readMsgBtn = document.getElementById('readMsg');
  const refreshEventsBtn = document.getElementById('refreshEvents');
  const clearEventsBtn = document.getElementById('clearEvents');
  const debugPre = document.getElementById('debug');
  const simBalanceEl = document.getElementById('sim-balance'); // match index.html id
  const showBalanceBtn = document.getElementById('show-sim-balance');
  const sendBtn = document.getElementById('send-sim');
  const simToInput = document.getElementById('sim-to');
  const simAmtInput = document.getElementById('sim-amount');

  function short(a){ return a ? (a.slice(0,6) + "..." + a.slice(-4)) : '(no addr)'; }
  function logDebug(...args){
    try{
      console.log(...args);
      if (debugPre) {
        debugPre.innerText += '\n' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        debugPre.scrollTop = debugPre.scrollHeight;
      }
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
    // prefer BrowserProvider if present, otherwise Web3Provider
    try {
      provider = (ethers && ethers.BrowserProvider) ? new ethers.BrowserProvider(window.ethereum) : new ethers.providers.Web3Provider(window.ethereum);
    } catch (e) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
    }
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);
    logDebug('attach: provider & contract ready', contractAddress);
  }

  // Update SIM balance UI using token.js helper (works with window.simToken)
  async function updateSimBalance(address) {
    try {
      if (!simBalanceEl) return;
      if (window.simToken && typeof window.simToken.getTokenInfo === 'function') {
        const info = await window.simToken.getTokenInfo(address);
        // info.formatted or info.balance both may exist
        const bal = info.formatted ?? info.balance ?? String(info.raw ?? '0');
        const symbol = info.symbol ?? 'SIM';
        simBalanceEl.innerText = `${bal} ${symbol}`;
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
      const addr = accounts && accounts[0] ? accounts[0] : (await signer.getAddress());
      walletStatus.innerText = 'Connected: ' + short(addr);
      if (connectBtn) { connectBtn.innerText = 'Connected'; connectBtn.disabled = true; }
      await readCurrentMessage();
      await fetchPastEvents();
      listenEvents();
      // update SIM balance right after connect
      await updateSimBalance(addr);
      logDebug('Connected', addr);
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
      // refresh SIM balance after action (in case)
      try { await updateSimBalance(window.ethereum.selectedAddress || (await signer.getAddress())); } catch(e){}
      logDebug('setMessage tx', receipt.transactionHash);
    }catch(e){
      console.error('doSetMessage error ->', e);
      toast('setMessage failed (see console)');
    }
  }

  async function readCurrentMessage(){
    try{
      const m = await contract.message();
      const el = document.getElementById('currentMessage');
      if (el) el.innerText = m || '(empty)';
    }catch(e){
      console.error('readCurrentMessage error ->', e);
      toast('Read message failed (see console)');
    }
  }

  async function fetchPastEvents(){
    try{
      const iface = new ethers.Interface(abi);
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

  // SIM send handler (uses token.js transfer)
  async function sendSimHandler() {
    try {
      const to = simToInput.value.trim();
      const amt = simAmtInput.value.trim();
      if (!to || !amt) return toast('Enter recipient & amount!');
      if (!window.simToken || typeof window.simToken.transfer !== 'function') {
        return toast('Token helper missing');
      }
      // call transfer (this will prompt MetaMask)
      const tx = await window.simToken.transfer(to, amt);
      toast('SIM transfer sent: ' + tx.hash);
      await tx.wait();
      toast('SIM transfer confirmed');
      // refresh balance
      try { await updateSimBalance(window.ethereum.selectedAddress || (await signer.getAddress())); } catch(e){}
    } catch (e) {
      console.error('sendSimHandler error', e);
      toast('SIM send failed (see console)');
    }
  }

  // wire up buttons
  if (document.getElementById('connect')) document.getElementById('connect').onclick = connectWallet;
  if (document.getElementById('connectBtn')) document.getElementById('connectBtn').onclick = connectWallet;
  if (pingBtn) pingBtn.onclick = sendPing;
  if (setMsgBtn) setMsgBtn.onclick = doSetMessage;
  if (readMsgBtn) readMsgBtn.onclick = readCurrentMessage;
  if (refreshEventsBtn) refreshEventsBtn.onclick = () => { eventsDiv.innerHTML = ''; fetchPastEvents(); };
  if (clearEventsBtn) clearEventsBtn.onclick = () => { eventsDiv.innerHTML = ''; };
  if (showBalanceBtn) showBalanceBtn.onclick = async () => {
    try {
      const addr = window.ethereum && window.ethereum.selectedAddress ? window.ethereum.selectedAddress : (signer ? await signer.getAddress() : null);
      if (!addr) return toast('Connect wallet first');
      await updateSimBalance(addr);
    } catch (e) {
      console.error('showBalanceBtn error', e);
      toast('Read balance failed');
    }
  };
  if (sendBtn) sendBtn.onclick = sendSimHandler;

  // attempt silent attach if already connected
  if (window.ethereum && window.ethereum.selectedAddress) {
    try {
      await attach();
      const addr = window.ethereum.selectedAddress;
      walletStatus.innerText = 'Connected (silent): ' + short(addr);
      const btn = document.getElementById('connect') || document.getElementById('connectBtn');
      if (btn) { btn.innerText = 'Connected'; btn.disabled = true; }
      await readCurrentMessage();
      fetchPastEvents();
      listenEvents();
      try { await updateSimBalance(addr); } catch(e){}
      logDebug('Auto-attached to provider', addr);
    } catch (e) {
      // ignore silent attach errors
    }
  }

})();
