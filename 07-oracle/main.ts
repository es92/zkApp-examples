import { exit } from 'process';
import { OracleExample } from './CreditScoreOracle.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'snarkyjs';

await isReady;
// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qoAE4rBRuTgC42vqvEyUqCGhaZsW58SKVW4Ht8aYqP9UTvxFWBgy';

let proofsEnabled = false;
function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: OracleExample,
  zkAppPrivatekey: PrivateKey,
  deployerKey: PrivateKey
) {
  const deployerAcc = deployerKey.toPublicKey();
  const txn = await Mina.transaction(deployerAcc, () => {
    AccountUpdate.fundNewAccount(deployerAcc);
    zkAppInstance.deploy({});
    // zkAppInstance.init(zkAppPrivatekey);
  });

  await txn.prove();
  await txn.sign([zkAppPrivatekey, deployerKey]).send();
}

const deployerKey: PrivateKey = createLocalBlockchain();
const deployerAcc: PublicKey = deployerKey.toPublicKey();
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

if (proofsEnabled) OracleExample.compile();

const zkAppInstance = new OracleExample(zkAppAddress);
await localDeploy(zkAppInstance, zkAppPrivateKey, deployerKey);
console.log('Contract deployed with address: ', zkAppAddress.toBase58());
const oraclePublicKey = zkAppInstance.oraclePublicKey.get();

const response = await fetch(
  'https://mina-credit-score-signer-pe3eh.ondigitalocean.app/user/1'
);
const data = await response.json();

const id = Field(data.data.id);
const creditScore = Field(data.data.creditScore);
const signature = Signature.fromJSON(data.signature);
console.log('About to verify signature: ', signature.toBase58());

console.log('Credit score:', creditScore.toString());

const txn = await Mina.transaction(deployerAcc, () => {
  zkAppInstance.verify(id, creditScore, signature);
});
// await txn.prove();
console.log('About to send');
await txn.sign([deployerKey]).send();

const events = await zkAppInstance.fetchEvents();
const verifiedEventValue = events[0].event.data.toFields(null)[0];

console.log('Event received: ', verifiedEventValue);

// `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
// Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
// This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
setTimeout(shutdown, 0);
