import fetch, {Headers} from 'node-fetch';
import * as dotenv from "dotenv";

dotenv.config();

let cache = {}

export async function lookupContractNameInDune(contractAddress: string) {
    console.log("Dune cache", cache)
    try {
        if (cache[contractAddress]) {
            console.log("Done, returning cached value ", contractAddress)
            return cache[contractAddress]
        }
        console.log("Dune request", contractAddress)
        const meta = {
            "x-dune-api-key": process.env.DUNE_ACCESS_KEY
        };
        const header = new Headers(meta);

        const queryId = 1528731
        var body = JSON.stringify({"query_parameters": {"contract_address": contractAddress.substring(2)}});
        const execResponse = await fetch(`https://api.dune.com/api/v1/query/${queryId}/execute`, {
            method: 'POST',
            headers: header,
            body: body
        });
        const response_object = await execResponse.text();

        console.log(response_object);
        const executionId = JSON.parse(response_object).execution_id

        while (true) {
            const resultResponse = await fetch(`https://api.dune.com/api/v1/execution/${executionId}/results`, {
                method: 'GET',
                headers: header
            });
            let resultData = JSON.parse(await resultResponse.text());
            console.log(resultData)
            if (resultData.state == "QUERY_STATE_COMPLETED") {
                if (resultData.result.rows.length > 0) {
                    const rowData = resultData.result.rows[0]
                    let niceContractName = rowData["namespace"] + "-" + rowData["name"];
                    cache[contractAddress] = niceContractName
                    console.log("Dune response", niceContractName)
                    return niceContractName
                } else {
                    return null
                }
            }
        }
    } catch (e) {
        console.log("Dune failed", contractAddress)
        return null
    }
}

lookupContractNameInDune("0xd921A81445Ff6A9114deb7Db011F5ef8353F0bBc")

