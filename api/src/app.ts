import express from 'express';
import * as dotenv from "dotenv";
import {ethers} from "ethers";

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

    return {}
}