import express, {Response} from 'express';
import * as dotenv from "dotenv";
import 'reflect-metadata'
import axios from "axios";
require('console-stamp')(console);
dotenv.config();

const app = express();
const port = 8485;
app.use(express.json());
app.use(express.urlencoded());

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});

app.post('/', async (req, res) => {
    if (req.body.method == 'eth_sendRawTransaction') {
        console.log(req.body)
        res.send("Ignored");
        return
    }
    let providerResponse = await forwardRequestToProvider(process.env.ETHEREUM_RPC_URL, req);
    resSend(res, providerResponse.data)
});

export async function forwardRequestToProvider<P, ResBody, ReqBody, ReqQuery, Locals>(providerUrl: string, req) {
    // console.log('PROVIDER request: ', JSON.stringify(req.body));
    let providerResponse = await axios.post(providerUrl, req.body, {
            headers: {'Content-Type': 'application/json'}
        }
    );
    // console.log('PROVIDER response: ', JSON.stringify(providerResponse.data));
    return providerResponse;
}

export function resSend<ResBody, Locals>(res: Response<ResBody, Locals>, data) {
    console.log('Response: ', JSON.stringify(data));
    res.send(data);
}