// -------------------------------
// IMPORT ETHERS (for V6)
// -------------------------------
import { ethers } from "./ethers.min.js";

// -------------------------------
// GLOBAL VARIABLES
// -------------------------------
let provider;
let signer;
let contract;

// -------------------------------
// CONTRACT DETAILS
// -------------------------------
const CONTRACT_ADDRESS = "0x28ee03ECB8e4d91325b3065e993A79F06aEf4a75";

const CONTRACT_ABI = [
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "action",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
            }
        ],
        "name": "ActionLogged",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "ping",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_msg",
                "type": "string"
            }
        ],
        "name": "setMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "message",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// -------------------------------
// 1. INITIALIZE WALLET & CONTRACT
// -------------------------------
async function init() {
    try {
        provider = new ethers.BrowserProvider(window.ethereum);

        signer = await provider.getSigner();
        console.log("Connected wallet:", await signer.getAddress());

        const code = await provider.getCode(CONTRACT_ADDRESS);

        if (code === "0x") {
            throw new Error("❌ ERROR: No contract deployed at this address!");
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Make available in browser console
        window.contract = contract;

        console.log("Contract loaded:", contract);

    } catch (err) {
        console.error("INIT ERROR:", err);
    }
}

init();


// -------------------------------
// 2. READ MESSAGE
// -------------------------------
async function readMessage() {
    try {
        const msg = await contract.message();
        console.log("Current message:", msg);
        return msg;
    } catch (err) {
        console.error("readMessage error:", err);
    }
}

window.readMessage = readMessage;


// -------------------------------
// 3. SET MESSAGE
// -------------------------------
async function setMessage(newMsg) {
    try {
        const tx = await contract.setMessage(newMsg);
        console.log("TX sent:", tx.hash);

        await tx.wait();
        console.log("Message updated!");
    } catch (err) {
        console.error("setMessage error:", err);
    }
}

window.setMessage = setMessage;


// -------------------------------
// 4. PING FUNCTION
// -------------------------------
async function ping() {
    try {
        const tx = await contract.ping();
        console.log("Ping TX:", tx.hash);

        awa
