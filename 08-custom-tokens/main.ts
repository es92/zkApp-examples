import { BasicTokenContract } from './BasicTokenContract.js';
import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Signature,
} from 'snarkyjs';

await isReady;

console.log('SnarkyJS loaded');

const proofsEnabled = false;
const Local = Mina.LocalBlockchain({ proofsEnabled });
Mina.setActiveInstance(Local);
const deployerAccount = Local.testAccounts[0].privateKey;
// ----------------------------------------------------

const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

console.log('compiling...');

let { verificationKey } = await BasicTokenContract.compile();

console.log('compiled');

// ----------------------------------------------------

console.log('deploying...');
const zkAppInstance = new BasicTokenContract(zkAppAddress);

const deploy_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.deploy({});
});

console.log('prooving...');
await deploy_txn.prove();
console.log('signing...');
console.log('Deployer: ', deployerAccount.toPublicKey().toBase58());
console.log('Contract: ', zkAppAddress.toBase58());
await deploy_txn.sign([deployerAccount, zkAppPrivateKey]).send();

// ----------------------------------------------------

console.log('initializing...');

const init_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  zkAppInstance.init();
});

await init_txn.prove();
await init_txn.sign([deployerAccount]).send();

console.log('initialized');

// ----------------------------------------------------

console.log('minting...');

const mintAmount = UInt64.from(10);

const mintSignature = Signature.create(
  zkAppPrivateKey,
  mintAmount.toFields().concat(zkAppAddress.toFields())
);

const mint_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.mint(zkAppAddress, mintAmount, mintSignature);
});

await mint_txn.prove();
await mint_txn.sign([deployerAccount, zkAppPrivateKey]).send();

console.log('minted');

console.log(
  zkAppInstance.totalAmountInCirculation.get() +
    ' ' +
    Mina.getAccount(zkAppAddress).tokenSymbol
);

// ----------------------------------------------------

console.log('sending...');

const sendAmount = UInt64.from(3);

const send_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.sendTokens(
    zkAppAddress,
    deployerAccount.toPublicKey(),
    sendAmount
  );
});
await send_txn.prove();
await send_txn.sign([deployerAccount, zkAppPrivateKey]).send();

console.log('sent');

console.log(
  zkAppInstance.totalAmountInCirculation.get() +
    ' ' +
    Mina.getAccount(zkAppAddress).tokenSymbol
);

// ----------------------------------------------------

console.log(
  'deployer tokens:',
  Mina.getBalance(
    deployerAccount.toPublicKey(),
    zkAppInstance.token.id
  ).value.toBigInt()
);

console.log(
  'zkapp tokens:',
  Mina.getBalance(zkAppAddress, zkAppInstance.token.id).value.toBigInt()
);

// ----------------------------------------------------

console.log('Shutting down');

await shutdown();
