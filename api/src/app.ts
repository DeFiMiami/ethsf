import express from 'express';
import * as dotenv from "dotenv";
import {BigNumber, ethers, Transaction} from "ethers";
import axios from "axios";
import {legos} from "@studydefi/money-legos";
import * as fs from "fs";
import path from "path";

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
    let tenderlyData = await simulateWithTenderly(transaction);

    if (!tenderlyData.transaction.status) {
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
            let toContract = contractsMap[contractAddress]
            if (toContract.contract_name) {
                betterName = toContract.contract_name
            }
        }
        if (transaction.from == contractAddress) {
            betterName = "Me"
        }
        return betterName;
    }

    let resultIndex = 0

    function bigNumberToHumanReadable(amount: BigNumber) {
        return amount.div(1e9).toString();
    }

    for (let i = 0; i < callTraces.length; i++) {
        let callTrace = callTraces[i];
        console.log("callTrace", callTrace)

        const contract = contractsMap[callTrace["to"]]
        if (contract == null) {
            console.log("Unknown contract", callTrace["to"])
            continue
        }

        if (contract.standards &&
            (contract.standards.includes("erc20") || contract.standards.includes("erc721"))) {
            let tokenSymbol = contract["token_data"]["symbol"];
            if (tokenSymbol == null) {
                tokenSymbol = contract["contract_name"]
            }

            try {
                const iface = new ethers.utils.Interface(legos.erc20.abi);
                const decodedArgs = iface.decodeFunctionData(callTrace.input.slice(0, 10), callTrace.input)
                const functionName = iface.getFunction(callTrace.input.slice(0, 10)).name
                console.log(functionName, decodedArgs)

                if (contract.standards.includes("erc20")) {
                    if (functionName == "transfer") {
                        let recipient = lookupContractName(decodedArgs[0])
                        let amount = bigNumberToHumanReadable(decodedArgs[1] as BigNumber)

                        let title = ++resultIndex + ". Transfer " + amount + " " + tokenSymbol + " to " + recipient;
                        result[title] = "OK"
                    }
                    if (functionName == "transferFrom") {
                        let sender = lookupContractName(decodedArgs[0])
                        let recipient = lookupContractName(decodedArgs[1])
                        let amount = bigNumberToHumanReadable(decodedArgs[2] as BigNumber);

                        let title = ++resultIndex + ". Transfer " + amount + " " + tokenSymbol + " to " + recipient;
                        result[title] = "OK"
                    }
                    if (functionName == "approve") {
                        let spender = lookupContractName(decodedArgs[0])
                        let amount = bigNumberToHumanReadable(decodedArgs[2] as BigNumber);

                        let title = ++resultIndex + ". Approve " + amount + " " + tokenSymbol + " to " + spender;
                        result[title] = "OK"
                    }
                } else if (contract.standards.includes("erc721")) {
                    if (functionName == "safeTransferFrom" || functionName == "transferFrom") {
                        let recipient = lookupContractName(decodedArgs[0])
                        let amount = bigNumberToHumanReadable(decodedArgs[1] as BigNumber)

                        let title = ++resultIndex + ". NFT Transfer " + amount + " " + tokenSymbol + " to " + recipient;
                        result[title] = "OK"
                    }
                    if (functionName == "setApprovalForAll") {
                        let operator = lookupContractName(decodedArgs[0])

                        let title = ++resultIndex + ". NFT approving to all";
                        result[title] = "WARNING"
                    }
                    if (functionName == "approve") {
                        let addressTo = lookupContractName(decodedArgs[0])
                        let tokenId = decodedArgs[0]

                        let title = ++resultIndex + ". NFT token#" + tokenId + " to " + addressTo;
                        result[title] = "WARNING"
                    }
                }
            } catch (e) {
                console.log(e, "Failed to decode callTrace for " + contract.address)
            }
        }
    }
    return result
}

async function dryRunSignedTransaction(serializedTransaction) {
    let deserializedTx = await ethers.utils.parseTransaction(serializedTransaction);
    return dryRunTransaction(deserializedTx)
}

async function simulateWithTenderly(deserializedTx: Transaction) {
    let tenderlyBody = {
        network_id: 5,
        from: deserializedTx.from,
        to: deserializedTx.to,
        input: deserializedTx.data,
        gas: 2000000,
        gas_price: 1000,
        value: deserializedTx.value.toString(),
    };
    const tenderlyUrl =
        "https://api.tenderly.co/api/v1/account/" +
        process.env.TENDERLY_USER +
        "/project/" +
        process.env.TENDERLY_PROJECT +
        "/simulate";

    let tenderlyResponse = await axios.post(
        tenderlyUrl, tenderlyBody, {
            headers: {
                'content-type': 'application/JSON',
                "X-Access-Key": process.env.TENDERLY_ACCESS_KEY,
            },
        }
    );
    let tenderlyData = tenderlyResponse.data;
    fs.writeFile('http-examples/tenderly-response.json', JSON.stringify(tenderlyData), function (err) {
        if (err) {
            return console.error(err);
        }
        console.log("File created!");
    });

    return tenderlyData
}
