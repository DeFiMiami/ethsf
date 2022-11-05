import express from 'express';
import * as dotenv from "dotenv";
import {ethers, Transaction} from "ethers";
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
        let result = await dryRunTransaction(signedTransaction);
        res.setHeader("access-control-allow-origin", "*")
        res.json(result);
    } catch (e) {
        console.log(e)
        res.status(500).json(e);
    }
});

app.get('/api', async (req, res) => {
    const t = JSON.parse(req.query.t as string)
    console.log('t=', t)

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

    res.setHeader("access-control-allow-origin", "*")
    res.json({"Firemask Metawall": "Metamask Firewall"});
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
                console.log(functionName, decodedArgs)
                if (functionName == "transfer") {
                    let toName = decodedArgs[0]
                    if (contractsMap[toName]) {
                        let toContract = contractsMap[toName]
                        if (toContract.contract_name) {
                            toName = toContract.contract_name
                        }
                    }
                    if (deserializedTx.from == toName) {
                        toName = "Me"
                    }

                    let amount = (decodedArgs[1].toNumber() / 1e18).toPrecision(6)
                    let title = "Transfer " + amount + " " + contract["token_data"]["symbol"] + " to " + toName;
                    let description = "OK";
                    result[title] = description
                }
            } catch (e) {
                console.log(e, "Failed to decode callTrace for " + contract.address)
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
