// -------------------------------
// GLOBAL VARIABLES
// -------------------------------
import { ethers } from "./ethers.min.js";

let provider;
let signer;
let contract;

const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";  // <--- PUT YOUR ADDRESS
const CONTRACT_ABI = [                                   // <--- PUT YOUR ABI
    {
        "inputs": [],
        "name": "message",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "address", "name": "user", "type": "address" },
            { "indexed": false, "internalType": "string", "name": "newMessage", "type": "string" }
        ],
        "name": "MessageChanged",
        "type": "event"
    }
];


// -------------------------------
// 1. INITIALIZE WALLET + CONTRACT
// -------------------------------

async function init() {
    try {
        console.log("Using BrowserProvider");

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();

        // Check network
        const network = await provider.getNetwork();
        console.log("Connected network:", network);

        // Check contract exists
        const code = await provider.getCode(CONTRACT_ADDRESS);
        if (code === "0x") {
            throw new Error("❌ No contract deployed at this address on this network.");
        }

        // Create contract instance
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Make available for console debugging
        window.contract = contract;

        console.log("Contract loaded:", contract);

    } catch (err) {
        console.error("init() error", err);
    }
}

init();


// -------------------------------
// 2. READ MESSAGE FUNCTION
// -------------------------------
async function readMessage() {
    try {
        if (!contract) throw new Error("Contract not initialized yet.");

        // Simulate call
        const raw = await provider.call({
            to: CONTRACT_ADDRESS,
            data: contract.interface.encodeFunctionData("message")
        });

        console.log("RAW returned data:", raw);

        if (raw === "0x") {
            throw new Error("Contract returned empty data. Wrong ABI or function missing.");
        }

        // Decode safely
        const decoded = contract.interface.decodeFunctionResult("message", raw);
        console.log("De
