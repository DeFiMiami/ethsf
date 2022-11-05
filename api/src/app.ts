import express from 'express';
import * as dotenv from "dotenv";
import {BigNumber, ethers} from "ethers";
import {abi as ERC20_abi} from "@openzeppelin/contracts/build/contracts/ERC20.json";
import {abi as ERC721_abi} from "@openzeppelin/contracts/build/contracts/ERC721.json";
import {abi as ERC1155_abi} from "@openzeppelin/contracts/build/contracts/ERC1155.json";

import path from "path";
import {simulateWithTenderly} from "./tenderly-utils";

require('console-stamp')(console);

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"));

const port = process.env.PORT == null ? 5000 : process.env.PORT;

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.post('/api', async (req, res) => {
    try {
        let signedTransaction = req.body.transaction;
        let result = await dryRunSignedTransaction(signedTransaction);

        res.setHeader("access-control-allow-origin", "*")
        res.json(result);
    } catch (e) {
        console.log(e)
        res.status(500).json(e);
    }
});

// Example of tx
// {
//   from: '0xc1531732b4f63b77a5ea38f4e5dbf5553f02c9be',
//   to: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45',
//   value: '0x5af3107a4000',
//   data: '0x5a...',
//   gas: '0x2d3f3',
//   maxFeePerGas: '0x26944272a',
//   maxPriorityFeePerGas: '0x59682f00',
//   chainId: 'eip155:5'
// }
app.get('/api', async (req, res) => {
    try {
        console.log('req', req.url)
        const transactionData = JSON.parse(req.query.t as string)
        let result = await dryRunTransaction(transactionData)

        res.setHeader("access-control-allow-origin", "*")
        res.json(result);
    } catch (e) {
        console.log(e)
        res.status(500).json(e);
    }
});

async function dryRunTransaction(transaction) {
    console.log("Start")
    let tenderlyData = await simulateWithTenderly(transaction);

    if (!tenderlyData.transaction.status) {
        console.log("Done")
        return {"Transaction failed": tenderlyData.transaction.error_message}
    }

    const contractsMap = {}
    for (const contract of tenderlyData.contracts) {
        contractsMap[contract.address] = contract
    }

    let result = {}
    let callTraces = tenderlyData.transaction.call_trace;

    function lookupContractName(contractAddress) {
        let betterName = contractAddress
        if (contractsMap[contractAddress]) {
            let toContract = contractsMap[contractAddress.toLowerCase()]
            if (toContract.contract_name) {
                betterName = toContract.contract_name
            }
        }
        if (transaction.from.toLowerCase() == contractAddress.toLowerCase()) {
            betterName = "ME"
        }
        return betterName;
    }

    let resultIndex = 0

    for (let i = callTraces.length - 1; i > 0; i--) {
        let callTrace = callTraces[i];
        console.log("callTrace", callTrace)

        const contract = contractsMap[callTrace["to"].toLowerCase()]
        if (contract == null) {
            console.log("Unknown contract", callTrace["to"])
            continue
        }

        try {
            let iface
            if (contract.standards.includes("erc20")) {
                iface = new ethers.utils.Interface(ERC20_abi);
            } else if (contract.standards.includes("erc721")) {
                iface = new ethers.utils.Interface(ERC721_abi);
            } else if (contract.standards.includes("erc1155")) {
                iface = new ethers.utils.Interface(ERC1155_abi);
            } else {
                console.log("Skipping contract", contract["address"])
                continue
            }

            const decodedArgs = iface.decodeFunctionData(callTrace.input.slice(0, 10), callTrace.input)
            const functionName = iface.getFunction(callTrace.input.slice(0, 10)).name
            console.log(functionName, decodedArgs)

            let tokenSymbol = contract["token_data"]["symbol"];
            if (tokenSymbol == null) {
                tokenSymbol = contract["contract_name"]
            }
            const bigNumberToHumanReadable = (amount: BigNumber) => {
                console.log("amount", amount)
                let decimals = 18
                if (contract['token_data'] && contract['token_data']['decimals']) {
                    decimals = contract['token_data']['decimals']
                }
                let amountStr = ethers.utils.formatUnits(amount, decimals);
                if (amountStr.indexOf(".") == -1) {
                    return amountStr
                } else {
                    let point = amountStr.indexOf(".")
                    return amountStr.slice(0, point) + amountStr.slice(point).slice(0, 7)
                }
            }
            if (contract.standards.includes("erc20")) {
                if (functionName == "transfer") {
                    let recipient = lookupContractName(decodedArgs[0])
                    let amount = bigNumberToHumanReadable(decodedArgs[1] as BigNumber)

                    let title = ++resultIndex + ". Transfer"
                    let description = "Transfer " + amount + " " + tokenSymbol + " to " + recipient;
                    result[title] = description
                }
                if (functionName == "transferFrom") {
                    let sender = lookupContractName(decodedArgs[0])
                    let recipient = lookupContractName(decodedArgs[1])
                    let amount = bigNumberToHumanReadable(decodedArgs[2] as BigNumber);

                    let title = ++resultIndex + ". Transfer"
                    let description = "Transfer " + amount + " " + tokenSymbol + " to " + recipient;
                    result[title] = description
                }
                if (functionName == "approve") {
                    let spender = lookupContractName(decodedArgs[0])
                    let amount = bigNumberToHumanReadable(decodedArgs[2] as BigNumber);

                    let title = ++resultIndex + ". Approve " + amount + " " + tokenSymbol + " to " + spender;
                    result[title] = ""
                }
            } else if (contract.standards.includes("erc721")) {

                if (functionName == "safeTransferFrom" || functionName == "transferFrom") {
                    let from = lookupContractName(decodedArgs[0])
                    let recipient = lookupContractName(decodedArgs[1])
                    let tokenId = (decodedArgs[2] as BigNumber).toNumber();

                    const quicknodeData = getNFTinfo(from,
                          contract["address"], tokenId)
                          .then((result) => console.log(result))

                    // let title = ++resultIndex + ". NFT Transfer";
                    // let description = "Transfer NFT token #" + tokenId + " to " + recipient;
                    result['NFT Indights'] = quicknodeData
                }
                if (functionName == "setApprovalForAll") {
                    let operator = lookupContractName(decodedArgs[0])

                    let title = ++resultIndex + ". NFT approving to all";
                    result[title] = "TODO"
                }
                if (functionName == "approve") {
                    let addressTo = lookupContractName(decodedArgs[0])
                    let tokenId = (decodedArgs[1] as BigNumber).toNumber();

                    let title = ++resultIndex + ". NFT approve";
                    result[title] = "TODO"
                }
            }
        } catch (e) {
            console.log(e, "Failed to decode callTrace for " + contract.address)
        }

    }
    console.log("Done")
    return result
}

async function dryRunSignedTransaction(serializedTransaction) {
    let deserializedTx = await ethers.utils.parseTransaction(serializedTransaction);
    return dryRunTransaction(deserializedTx)
}

