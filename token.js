// token.js — SIM token helper (ethers v6 UMD compatible)
// Replace TOKEN_ADDRESS with your SIM token contract address on Sepolia
const TOKEN_ADDRESS = "0x859d4e1340B20B2cD3ECa711ea1088784bB3F886"; // <<--- REPLACE THIS

const SIM_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

(function () {
  if (window.simToken) return;

  const helper = {
    provider: null,
    signer: null,
    contract: null,
    decimals: 18,

    async ensureProvider() {
      if (this.provider) return;
      if (!window.ethereum) throw new Error("MetaMask (window.ethereum) not found");
      // prefer BrowserProvider, fallback to Web3Provider
      if (ethers.BrowserProvider) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        this.provider = new ethers.providers.Web3Provider(window.ethereum);
      }
    },

    async initReadonly() {
      if (this.contract) return;
      await this.ensureProvider();
      // validate address
      try { if (typeof ethers.getAddress === 'function') ethers.getAddress(TOKEN_ADDRESS); } catch (e) {
        console.error("TOKEN_ADDRESS invalid. Replace with real contract address.", e);
        throw e;
      }
      this.contract = new ethers.Contract(TOKEN_ADDRESS, SIM_ABI, this.provider);
      try { this.decimals = await this.contract.decimals(); } catch (e) { this.decimals = 18; }
    },

    async getSigner() {
      await this.ensureProvider();
      if (!this.signer) {
        await this.provider.send("eth_requestAccounts", []);
        this.signer = this.provider.getSigner();
      }
      return this.signer;
    },

    async getInfo(address) {
      await this.initReadonly();
      if (!address) throw new Error("Address required");
      const raw = await this.contract.balanceOf(address);
      const formatted = ethers.formatUnits(raw, this.decimals);
      let symbol = "SIM";
      try { symbol = await this.contract.symbol(); } catch (e) {}
      return { raw, formatted, symbol };
    },

    async transfer(to, amount) {
      if (!to || !amount) throw new Error("Missing to or amount");
      if (typeof to === 'string' && to.includes('.')) {
        throw new Error("ENS names not supported on this network — use an address");
      }
      await this.getSigner();
      const writeContract = this.contract.connect(this.signer);
      const parsed = ethers.parseUnits(amount.toString(), this.decimals);
      const tx = await writeContract.transfer(to, parsed);
      return tx;
    }
  };

  window.simToken = helper;
  console.log("simToken helper installed");
})();
