// token.js
// Requires ethers.js (v5). Include <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.min.js"></script> in your HTML

const TOKEN_ADDRESS = "0x41ae2c24bfea924b0055bdddf47f8397f571710f"; // your SIM token contract address
const tokenAbi = [
  // minimal ABI for ERC-20 basics used in this dApp
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

let provider;
let signer;
let tokenContract;

async function initProvider() {
  if (window.ethereum === undefined) {
    throw new Error("MetaMask (window.ethereum) not found. Install MetaMask and retry.");
  }
  provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, provider);
}

// Connect wallet (MetaMask)
async function connectWallet() {
  await initProvider();
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  const address = await signer.getAddress();
  // connect token contract with signer for write calls
  tokenContract = tokenContract.connect(signer);
  return address;
}

// Get token details & balance (human-readable)
async function getTokenInfo(address) {
  if (!tokenContract) await initProvider();
  const [symbol, decimals, name, rawBal] = await Promise.all([
    tokenContract.symbol(),
    tokenContract.decimals(),
    tokenContract.name(),
    tokenContract.balanceOf(address)
  ]);
  const balance = ethers.utils.formatUnits(rawBal, decimals);
  return { name, symbol, decimals, balance };
}

// Send tokens (from connected account)
async function sendTokens(toAddress, amountDecimal) {
  if (!signer) await connectWallet();
  const decimals = await tokenContract.decimals();
  const amount = ethers.utils.parseUnits(amountDecimal.toString(), decimals);
  const tx = await tokenContract.transfer(toAddress, amount);
  return tx; // caller can wait tx.wait()
}

// Approve spender
async function approveSpender(spenderAddress, amountDecimal) {
  if (!signer) await connectWallet();
  const decimals = await tokenContract.decimals();
  const amount = ethers.utils.parseUnits(amountDecimal.toString(), decimals);
  const tx = await tokenContract.approve(spenderAddress, amount);
  return tx;
}

// Check allowance
async function checkAllowance(ownerAddress, spenderAddress) {
  if (!tokenContract) await initProvider();
  const raw = await tokenContract.allowance(ownerAddress, spenderAddress);
  const decimals = await tokenContract.decimals();
  return ethers.utils.formatUnits(raw, decimals);
}

// TransferFrom (must be called by an address that has allowance)
async function transferFromAsSpender(fromAddress, toAddress, amountDecimal) {
  if (!signer) await connectWallet();
  const decimals = await tokenContract.decimals();
  const amount = ethers.utils.parseUnits(amountDecimal.toString(), decimals);
  const tx = await tokenContract.transferFrom(fromAddress, toAddress, amount);
  return tx;
}

// Utility: wait for tx confirmation and return receipt
async function waitTx(tx) {
  const receipt = await tx.wait();
  return receipt;
}

// Export functions for browser usage
window.simToken = {
  connectWallet,
  getTokenInfo,
  sendTokens,
  approveSpender,
  checkAllowance,
  transferFromAsSpender,
  waitTx,
  TOKEN_ADDRESS
};
