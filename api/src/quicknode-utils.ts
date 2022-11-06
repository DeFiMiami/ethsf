const ethers = require("ethers");

const qnUrl = 'https://divine-smart-bush.discover.quiknode.pro/ad2912eea96014c55cf51bb41b4a0eb78edd36d5/';

export async function getNFTinfo(from, recipient, contract, tokenId) {
  const provider = new ethers.providers.JsonRpcProvider(qnUrl);
  // provider.connection.headers = { "x-qn-api-version": 1 };
  const heads = await provider.send("qn_fetchNFTs", {
    wallet: from,
    omitFields: ["provenance", "traits"],
    page: 1,
    perPage: 10,
    contracts: [
      `${contract}:${tokenId}`
    ],
  });
  const asset = heads.assets[0]
  return `Name: ${asset.name}, Collection: ${asset.collectionName}, Sender: ${asset.currentOwner}, Receiver: ${recipient}`
}