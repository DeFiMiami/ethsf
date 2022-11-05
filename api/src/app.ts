import express from 'express';
import * as dotenv from "dotenv";
import {BigNumber, ethers, Transaction} from "ethers";
import axios from "axios";
import {legos} from "@studydefi/money-legos";

require('console-stamp')(console);

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded());

const port = 8000;

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});

app.post('/', async (req, res) => {
    let signedTransaction = req.body.transaction;
    let result = await dryRunTransaction(signedTransaction);
    res.send(result);
});

async function dryRunTransaction(serializedTransaction) {
    let deserializedTx = await ethers.utils.parseTransaction(serializedTransaction);
    let tenderlyData = await simulateWithTenderly(deserializedTx);

    if (!tenderlyData.transaction.status) {
        return {"Transaction failed": tenderlyData.transaction.error_message}
    }

    const contractsMap = {}
    for (const contract of tenderlyData.contracts) {
        contractsMap[contract.address] = contract
    }

    let result = {}
    let callTraces = tenderlyData.transaction.call_trace;
    for (let i = 0; i < callTraces.length; i++) {
        let callTrace = callTraces[i];
        const contract = contractsMap[callTrace["to"]]
        if (contract == null) {
            console.log({"Unknown contract": callTrace["to"]})
            continue
        }

        if (contract.standards && contract.standards.includes("erc20")) {
            console.log(callTrace)

            try {
                const iface = new ethers.utils.Interface(legos.erc20.abi);
                const decodedArgs = iface.decodeFunctionData(callTrace.input.slice(0, 10), callTrace.input)
                const functionName = iface.getFunction(callTrace.input.slice(0, 10)).name
                console.log(functionName)
                console.log(decodedArgs)
                if (functionName == "transfer") {
                    let toAddress = decodedArgs[0]
                    let amount = (decodedArgs[1] as BigNumber).toString()
                    let title = "Transfer " + amount + " " + contract["token_data"]["symbol"] + " to " + toAddress;
                    let description = "OK";
                    result[title] = description
                }
            } catch (e) {
                console.log("Failed to decode callTrace for " + contract.address)
            }
        }
    }
    return result
}

async function simulateWithTenderly(deserializedTx: Transaction) {
    let tenderlyBody = {
        network_id: deserializedTx.chainId,
        from: deserializedTx.from,
        to: deserializedTx.to,
        input: deserializedTx.data,
        gas: 200000,
        gas_price: 100,
        value: deserializedTx.value.toString(),
    };
    console.log(JSON.stringify(tenderlyBody))
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
    console.log(JSON.stringify(tenderlyData))

    return tenderlyData
}
