// https://github.com/rhvall/MinaDevContainer
// Based on code from https://github.com/o1-labs/docs2
// May 2023
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { Square } from './Square.js';
import { Field, Mina, PrivateKey, AccountUpdate } from 'snarkyjs';

console.log('SnarkyJS loaded');

const useProof = false;

// ----------------------------------------------------
// Load a local instance of the Mina blockchain
const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
const { privateKey: senderKey, publicKey: senderAccount } =
  Local.testAccounts[1];

console.log('Using deployer local account: ', deployerAccount.toBase58());
console.log('Using sender local account: ', senderAccount.toBase58());

// ----------------------------------------------------
// Create a public/private key pair. The public key is our address and where we will deploy to
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

// ----------------------------------------------------
// Create an instance of Square zkApp contract - and deploy it to zkAppAddress
const zkAppInstance = new Square(zkAppAddress);
const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkAppInstance.deploy();
});
await deployTxn.sign([deployerKey, zkAppPrivateKey]).send();

// ----------------------------------------------------
// Get the initial state of Square after deployment
const num0 = zkAppInstance.num.get();
console.log('State after init:', num0.toString());

// ----------------------------------------------------
// Perform serveral updates to the zkApp state
const txn1 = await Mina.transaction(senderAccount, () => {
  zkAppInstance.update(Field(9));
});
await txn1.prove();
await txn1.sign([senderKey]).send();

const num1 = zkAppInstance.num.get();
console.log('State after txn1:', num1.toString());

// ----------------------------------------------------
try {
  const txn2 = await Mina.transaction(senderAccount, () => {
    zkAppInstance.update(Field(75));
  });
  await txn1.prove();
  await txn2.sign([senderKey]).send();
} catch (ex: any) {
  console.log(ex.message);
  console.log(
    'Expected assert above, given the value to update is not the square of the previous state'
  );
}
const num2 = zkAppInstance.num.get();
console.log('State after txn2:', num2.toString());

// ----------------------------------------------------
const txn3 = await Mina.transaction(senderAccount, () => {
  zkAppInstance.update(Field(81));
});
await txn3.prove();
await txn3.sign([senderKey]).send();

const num3 = zkAppInstance.num.get();
console.log('State after txn3:', num3.toString());

// ----------------------------------------------------

console.log('Main01 Finished');
