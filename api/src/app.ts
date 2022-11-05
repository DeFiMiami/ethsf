import express from 'express';
import * as dotenv from "dotenv";
import {ethers, Transaction} from "ethers";
import axios from "axios";

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
    console.log(tenderlyData)
    return {}
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
    return tenderlyData;
}
