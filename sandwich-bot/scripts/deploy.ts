import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Deploying Sandwich Contract...\n');

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  console.log(`Deploying from address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Read contract
  const contractPath = path.join(__dirname, '../contracts/SandwichContract.sol');
  const contractSource = fs.readFileSync(contractPath, 'utf8');

  console.log('Contract read successfully');
  console.log('Note: You need to compile this contract using Hardhat or Foundry\n');

  // Contract constructor parameters
  const UNISWAP_V2_ROUTER = process.env.UNISWAP_V2_ROUTER;
  const WETH_ADDRESS = process.env.WETH_ADDRESS;

  console.log('Deployment Parameters:');
  console.log(`Uniswap V2 Router: ${UNISWAP_V2_ROUTER}`);
  console.log(`WETH Address: ${WETH_ADDRESS}\n`);

  console.log('⚠️  To deploy this contract, use Hardhat or Foundry:');
  console.log('\nUsing Hardhat:');
  console.log('  npx hardhat compile');
  console.log('  npx hardhat run scripts/deploy.ts --network localhost');
  console.log('\nUsing Foundry:');
  console.log('  forge build');
  console.log(`  forge create SandwichContract --constructor-args ${UNISWAP_V2_ROUTER} ${WETH_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
