// TransactionsTable.tsx
import eth from '../eth.svg';
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Network, Alchemy } from "alchemy-sdk";
const { Utils } = require("alchemy-sdk");


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
  gasUsed: string;
  zkGasPrice: string;
  txZkCostUSD: string;
  ethGasPrice: string | undefined;
  txEthCostUSD: number;
  diffUSD: number;
  totalCost: number;
}

async function getTransactionData(
  updateData: (data: TransactionData) => void
): Promise<void> {
  const transactions = await getTransactions();
  let totalCost: number = 0;
  // iterate over transactions on zk Node
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
    const ethGasPrice = await getGasPriceOnEth(unixTimestamp);
    const gasUsed = transaction.gas_used;
    const gasPrice = transaction.gas_price;
    const txZkCostUSD = (gasUsed * gasPrice * price_usd) / 1e18;
    console.log("ethGasPrice", Utils.formatEther(ethGasPrice))
    const ethGasPriceEth = Utils.formatEther(ethGasPrice);
    const txEthCostUSD = gasUsed * price_usd * ethGasPriceEth;
    // let totalZkCost = totalZkCost + txZkCostUSD;
    const shortHash =
      transaction.hash.slice(0, 6) + "..." + transaction.hash.slice(-4);
    console.log(`Transaction ${shortHash} on ${date} zkCost ${txZkCostUSD} USD, ethCost ${txEthCostUSD} USD`);
    const toPrint: TransactionData = {
      hash: transaction.hash,
      shortHash,
      date,
      gasUsed,
      zkGasPrice: (gasPrice / 1000000000).toFixed(4).toString(),
      txZkCostUSD: txZkCostUSD.toFixed(4).toString(),
      ethGasPrice: (ethGasPriceEth * 1000000000).toFixed(4).toString(),
      txEthCostUSD,
      diffUSD:  txEthCostUSD -txZkCostUSD,
      totalCost,
    };
    updateData(toPrint);
  });
}

async function getGasPriceOnEth(targetTimestamp: number) {
  const averageBlockTime = 15.1;
  let block = await alchemy.core.getBlock('latest');
  console.log("latest block", block);
  let blockNumber = block.number;
  let blockTime = block.timestamp;
  const decreaseBlocks = Math.floor((blockTime - targetTimestamp) / averageBlockTime);
  blockNumber -= decreaseBlocks;

  // find blockhash to get first Tx. 
  console.log(`using Ethereum block={blockNumber} to get gasPrice`);
  block = await alchemy.core.getBlock(blockNumber);

  // get gasPrice from the first transaction in this block
  const transactions = await alchemy.core.getBlockWithTransactions(block.hash);
  if (transactions && transactions.transactions && transactions.transactions.length) {
    console.log("Transaction[0] gasPrice:", transactions.transactions[0].gasPrice?.toString());
  }
  else {
    console.log("No transactions found");
  }
  return transactions.transactions[0].gasPrice;
};

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
            <th>Gas Used</th>
            <th>zk Gas Price (GWEI)</th>
            <th>Value in USD</th>
            <th className="eth-background">
              <img src={eth} alt="Ethereum" style={{ height: '20px' }} />
              Gas Price (GWEI)</th>
            <th className="eth-background">
              <img src={eth} alt="Ethereum" style={{ height: '20px' }} />
              Value in USD</th>
            <th>Saving (USD)</th>
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

              <td><span style={{ whiteSpace: 'nowrap' }}>{transaction.date}</span></td>
              <td>{transaction.gasUsed}</td>
              <td>{transaction.zkGasPrice}</td>
              <td>{transaction.txZkCostUSD}</td>
              <td className="eth-background">{transaction.ethGasPrice}</td>
              <td className="eth-background">{(transaction.txEthCostUSD).toFixed(4)}</td>
              <td>{(transaction.diffUSD).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default TransactionsTable;
