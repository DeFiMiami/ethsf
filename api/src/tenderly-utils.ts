import {Transaction} from "ethers";
import axios from "axios";
import fs from "fs";

let cache = {}
export async function simulateWithTenderly(deserializedTx: Transaction) {
    console.log("Tenderly start")
    let tenderlyBody = {
        network_id: deserializedTx.chainId,
        from: deserializedTx.from,
        to: deserializedTx.to,
        input: deserializedTx.data,
        gas: 2000000,
        gas_price: 1000,
        value: deserializedTx.value.toString(),
    };
    let cacheKey = JSON.stringify(tenderlyBody);
    if (cache[cacheKey]) {
        console.log("Tenderly, returning cached value ", cacheKey)
        return cache[cacheKey]
    }

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
        console.log("Tenderly response saved");
    });
    cache[cacheKey] = tenderlyData
    return tenderlyData
}