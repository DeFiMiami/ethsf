import {
  OnTransactionHandler,
  OnRpcRequestHandler,
} from '@metamask/snap-types';


/**
 * Get a message from the origin. For demonstration purposes only.
 *
 * @param originString - The origin string.
 * @returns A message based on the origin.
 */
export const getMessage = (originString: string): string =>
  `Hello, ${originString}!`;

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_confirm` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = ({ origin, request }) => {
  switch (request.method) {
    case 'hello':
      return wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: getMessage(origin),
            description:
              'This custom confirmation is just for display purposes.',
            textAreaContent:
              'But you can edit the snap source code to make it do something, if you want to!',
          },
        ],
      });
    default:
      throw new Error('Method not found.');
  }
};

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  chainId,
}) => {
  // Example of tx
  // {"from":"0xc1531732b4f63b77a5ea38f4e5dbf5553f02c9be",
  // "to":"0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  // "value":"0x5af3107a4000","data":"0xd0e30db0","gas":"0x6d3e",
  // "maxFeePerGas":"0x68e8a8b8","maxPriorityFeePerGas":"0x59682f00"}
  transaction.chainId = chainId;

  const url = 'http://localhost:5000/api?t=';
  // const url = 'https://firemask-metawall.herokuapp.com?t';

  const t = JSON.stringify(transaction);
  const info = await fetch(url + encodeURIComponent(t));
  const insights = await info.json();
  return { insights };
};
