/**
 * This script can be used to interact with the Add contract, after deploying it.
 *
 * We call the update() method on the contract, create a proof and send it to the chain.
 * The endpoint that we interact with is read from your config.json.
 *
 * This simulates a user interacting with the zkApp from a browser, except that here, sending the transaction happens
 * from the script and we're using your pre-funded zkApp account to pay the transaction fee. In a real web app, the user's wallet
 * would send the transaction and pay the fee.
 *
 * To run locally:
 * Build the project: `$ npm run build`
 * Run with node:     `$ node build/src/interact.js <network>`.
 */
import { Mina, PrivateKey, shutdown, Field, isReady, AccountUpdate } from 'snarkyjs';
import fs from 'fs/promises';
import { Add, users } from './message.js';

(async function main() {
  await isReady;

  console.log('SnarkyJS loaded');

  const proofsEnabled = false;
  const Local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(Local);
  const deployerAccount = Local.testAccounts[0].privateKey;

  if (proofsEnabled) {
    Add.compile();
  }

  // ----------------------------------------------------

  // create a destination we will deploy the smart contract to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // create an instance of Add - and deploy it to zkAppAddress
  const zkAppInstance = new Add(zkAppAddress);
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
  });

  await deploy_txn.prove();
  deploy_txn.sign([zkAppPrivateKey]);
  await deploy_txn.send();

  // get the initial state of Add after deployment
  const message0 = zkAppInstance.message.get();
  console.log('state after init:', message0.toString());

  // ----------------------------------------------------

  const txn1 = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.publishMessage(Field(9), users.Bob);
  });

  await txn1.prove();
  await txn1.send();

  const message1 = zkAppInstance.message.get();
  console.log('state after txn1:', message1.toString());

  // ----------------------------------------------------

  try {
    const txn2 = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.publishMessage(Field(75), users.Jack);
    });

    await txn2.prove();
    await txn2.send();
  } catch (ex: any) {
    console.log(ex.message);
  }

  const message2 = zkAppInstance.message.get();
  console.log('state after txn2:', message2.toString());

  // ----------------------------------------------------

  console.log('Shutting down');

  await shutdown();
})();
