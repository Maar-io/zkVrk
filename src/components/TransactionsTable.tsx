// TransactionsTable.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Network, Alchemy } from "alchemy-sdk";

const ADDRESS = "0x00319D8f10A363252490cD2D4c58CFe571Da8288";
const ETHERSCAN_API_KEY = process.env.REACT_APP_ETHERSCAN_API
console.log(ETHERSCAN_API_KEY);
const ALCHEMY_API_KEY = process.env.REACT_APP_ALCHEMY_API_KEY
console.log(ALCHEMY_API_KEY);

// Optional Config object, but defaults to demo api-key and eth-mainnet.
const settings = {
  apiKey: ALCHEMY_API_KEY, // Replace with your Alchemy API Key.
  network: Network.ETH_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);

async function getTransactions() {
  const response = await axios.get(
    `https://zkatana.blockscout.com/api/v2/addresses/${ADDRESS}/transactions?filter=to%20%7C%20from`
  );
  console.log("response", response.data.items);
  return response.data.items;
}
async function getHistoricalEthGasPrice() {
  // console.log("ETHERSCAN_API_KEY set:", !!ETHERSCAN_API_KEY);

  // const response = await axios.get(`https://api.etherscan.io/api?module=account&action=txlist&address=${ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`);
  // return response.data.result;
  const latestBlock = await alchemy.core.getBlockNumber();
  console.log("The latest block number is", latestBlock);
}

async function getHistoricalPrice(date: string) {
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/coins/ethereum/history?date=${date}`
  );
  return response.data.market_data.current_price.usd;
}

async function getGecko() {
  let data;
  const api_url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum&vs_currencies=usd";
  async function getData() {
    const response = await fetch(api_url);
    data = await response.json();
    console.log("getGecko ethereum price", data.ethereum.usd);
  }
  getData();
}
interface TransactionData {
  hash: string;
  shortHash: string;
  date: string;
  gasPrice: string;
  gasUsed: string;
  txCostUSD: number;
  totalCost: number;
}

async function getTransactionData(
  updateData: (data: TransactionData) => void
): Promise<void> {
  const transactions = await getTransactions();
  let totalCost: number = 0;
  transactions.forEach(async (transaction: { timestamp: string | number | Date; gas_used: any; gas_price: any; hash: string; }) => {

    const dateObject = new Date(transaction.timestamp);
    const day = String(dateObject.getDate()).padStart(2, "0");
    const month = String(dateObject.getMonth() + 1).padStart(2, "0"); // January is 0!
    const year = dateObject.getFullYear();
    const date = `${day}-${month}-${year}`;
    const unixTimestamp = Math.floor(dateObject.getTime() / 1000);
    let price_usd;
    // try {
    //   price_usd = await new Promise<number>((resolve) =>
    //     setTimeout(() => resolve(getHistoricalPrice(date)), 2000)      
    //   );
    // } catch (error) {
    //   price_usd = 2000;
    //   console.error('An error occurred:', error);
    // }
    price_usd = 2000;
    const [blockNumber, blockTime] = await new Promise<[number, number]>((resolve) =>
      setTimeout(() => resolve(estimateBlockHeightByTimestamp(unixTimestamp)), 2000)
    );
    console.log("blockNumber", blockNumber)
    const gasUsed = transaction.gas_used;
    const gasPrice = transaction.gas_price;
    const txCostUSD = (gasUsed * gasPrice * price_usd) / 1e18;
    totalCost += txCostUSD;
    const shortHash =
      transaction.hash.slice(0, 6) + "..." + transaction.hash.slice(-4);
    console.log(`Transaction ${shortHash} on ${date} cost ${txCostUSD} USD`);
    const transactionData = {
      hash: transaction.hash,
      shortHash,
      date,
      gasPrice: (gasPrice / 1000000000).toString(),
      gasUsed,
      txCostUSD,
      totalCost,
    };
    updateData(transactionData);
  });
}

async function estimateBlockHeightByTimestamp(timestamp: number): Promise<[number, number]> {
  const targetTimestamp = timestamp;
  const averageBlockTime = 15.1;
  let block = await alchemy.core.getBlock('latest');
  let blockNumber = block.number;
  let blockTime = block.timestamp;

  const lowerLimitStamp = targetTimestamp;
  const higherLimitStamp = targetTimestamp + 30;

  let requestsMade = 1;

  while (blockTime > targetTimestamp) {
    const decreaseBlocks = Math.floor((blockTime - targetTimestamp) / averageBlockTime);
    if (decreaseBlocks < 1) {
      break;
    }

    blockNumber -= decreaseBlocks;
    block = await alchemy.core.getBlock(blockNumber);

    blockTime = block.timestamp;
    requestsMade += 1;
  }

  if (blockTime < lowerLimitStamp) {
    while (blockTime < lowerLimitStamp) {
      blockNumber += 1;

      block = await alchemy.core.getBlock(blockNumber);
      blockTime = block.timestamp;

      requestsMade += 1;
    }
  }

  if (blockTime > higherLimitStamp) {
    while (blockTime > lowerLimitStamp) {
      blockNumber -= 1;

      block = await alchemy.core.getBlock(blockNumber);
      blockTime = block.timestamp;

      requestsMade += 1;
    }
  }

  console.log('Number of Requests made: ' + requestsMade);
  return [blockNumber, blockTime];
}


function TransactionsTable() {
  const [data, setData] = useState<TransactionData[]>([]);

  useEffect(() => {
    getTransactionData((transactionData) => {
      setData((prevData) => [...prevData, transactionData]);
    });
  }, []);

  return (
    <>
      <h1>{ADDRESS}</h1>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Transaction Hash</th>
            <th>Date</th>
            <th>Gas Price (GWEI)</th>
            <th>Gas Used</th>
            <th>Value in USD</th>
          </tr>
        </thead>
        <tbody>
          {data.map((transaction, index) => (
            <tr key={index}>
              <td>{index + 1}</td>

              <td>
                <a
                  href={`https://zkatana.blockscout.com//tx/${transaction.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {transaction.shortHash}
                </a>
              </td>

              <td>{transaction.date}</td>
              <td>{transaction.gasPrice}</td>
              <td>{transaction.gasUsed}</td>
              <td>{transaction.txCostUSD}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default TransactionsTable;
