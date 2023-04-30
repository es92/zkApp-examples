import { Square } from './Square.js';
import {
  isReady,
  shutdown,
  fetchAccount,
  Mina,
  PrivateKey,
  AccountUpdate,
} from 'snarkyjs';
import fs from 'fs';
import { exit } from 'process';

await isReady;

console.log('SnarkyJS loaded');

const useProof = false;

const Berkeley = Mina.Network(
  'https://proxy.berkeley.minaexplorer.com/graphql'
);
Mina.setActiveInstance(Berkeley);

const transactionFee = 100_000_000;

const deployAlias = process.argv[2];
const deployerKeysFileContents = fs.readFileSync(
  'keys/' + deployAlias + '.json',
  'utf8'
);
const deployerPrivateKeyBase58 = JSON.parse(
  deployerKeysFileContents
).privateKey;
const deployerPrivateKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
const deployerPublicKey = deployerPrivateKey.toPublicKey();

let response = await fetchAccount({ publicKey: deployerPublicKey });
let accountExists = response.error == null;

if (accountExists == false) {
  console.log(
    'Deployer account does not exist. ' +
      'Request funds at faucet ' +
      'https://faucet.minaprotocol.com/?address=' +
      deployerPublicKey.toBase58()
  );
  exit(2);
}

console.log('Deployer public key:', deployerPublicKey.toBase58());
console.log('Deployer balance:', response.account?.balance.toString());

// ----------------------------------------------------

// Create a public/private key pair. The public key is our address and where we will deploy to
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

// create an instance of Square - and deploy it to zkAppAddress
const zkAppInstance = new Square(zkAppAddress);

let transaction = await Mina.transaction(
  { sender: deployerPublicKey, fee: transactionFee },
  () => {
    AccountUpdate.fundNewAccount(deployerPublicKey);
    // NOTE: this calls `init()` if this is the first deploy
    zkAppInstance.deploy({});
  }
);
await transaction.prove();
transaction.sign([deployerPrivateKey, zkAppPrivateKey]);

console.log('Sending the deploy transaction...');
const res = await transaction.send();
const hash = res.hash();
if (hash === undefined) {
  console.log('error sending transaction');
} else {
  console.log(
    'See deploy transaction at',
    'https://berkeley.minaexplorer.com/transaction/' + hash
  );
  console.log('waiting for zkApp account to be deployed...');
  await res.wait();
  console.log('zkApp fully deployed.');
}

// ----------------------------------------------------

console.log('Shutting down');

await shutdown();
