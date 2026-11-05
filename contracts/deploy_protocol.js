const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
    console.log('--- Starting PortixProtocol Deployment to Portaldot V3 ---');
    const rpcUrl = 'https://test-evm-rpc-v3.portaldot.dev';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('Deployer Address:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Current Balance:', ethers.formatEther(balance), 'tPOT');
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log('Current Nonce:', nonce);

    const artifactPath = 'project/contracts/out/PortixProtocol.sol/PortixProtocol.json';
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode.object;
    const abi = artifact.abi;

    console.log('Bytecode size:', (bytecode.length - 2) / 2, 'bytes');

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 22790n;
    console.log('Gas price:', gasPrice.toString());

    console.log('Estimating gas for deployment...');
    const estimatedGas = await provider.estimateGas({
        from: wallet.address,
        data: bytecode
    });
    console.log('Estimated gas:', estimatedGas.toString());
    const upfrontCost = estimatedGas * gasPrice;
    console.log('Upfront reservation cost:', ethers.formatEther(upfrontCost), 'tPOT');

    if (upfrontCost > balance) {
        throw new Error(`Insufficient balance: Upfront cost ${ethers.formatEther(upfrontCost)} exceeds balance ${ethers.formatEther(balance)}`);
    }

    console.log('Broadcasting deployment transaction...');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployTx = await factory.getDeployTransaction();
    
    // Send transaction with exact estimated gas to ensure it fits in balance
    const tx = await wallet.sendTransaction({
        ...deployTx,
        gasLimit: estimatedGas,
        gasPrice: gasPrice,
        nonce: nonce
    });

    console.log('Deployment Tx Hash:', tx.hash);
    console.log('Waiting for receipt...');
    const receipt = await tx.wait(1);
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('Contract Address:', receipt.contractAddress);
    console.log('Gas used:', receipt.gasUsed.toString());

    // Verify bytecode on-chain
    console.log('Verifying on-chain code with eth_getCode...');
    const code = await provider.getCode(receipt.contractAddress);
    if (code === '0x' || code.length <= 2) {
        throw new Error('Verification failed: eth_getCode returned 0x!');
    }
    console.log('On-chain code verified! Code length:', (code.length - 2) / 2, 'bytes');

    // Test contract calls
    const contract = new ethers.Contract(receipt.contractAddress, abi, provider);
    const pUSDC = await contract.pUSDC();
    console.log('Call pUSDC():', pUSDC);
    const feeBps = await contract.feeBps();
    console.log('Call feeBps():', feeBps.toString());
    const price = await contract.getPriceUSD(receipt.contractAddress);
    console.log('Call getPriceUSD():', price.toString());
    const asset = await contract.asset();
    console.log('Call asset():', asset);

    console.log('--- Deployment & Verification Successful! ---');
}

main().catch(err => {
    console.error('Deployment error:', err);
    process.exit(1);
});
