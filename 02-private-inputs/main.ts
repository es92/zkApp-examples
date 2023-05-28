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

import { IncrementSecret } from './IncrementSecret.js';
import { Field, Mina, PrivateKey, AccountUpdate } from 'snarkyjs';

console.log('SnarkyJS loaded');

// ----------------------------------------------------
// Load a local instance of the Mina blockchain
const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
console.log('Using deployer local account: ', deployerAccount.toBase58());

// Generate a random Field number
const salt = Field.random();

// ----------------------------------------------------
// Create a destination we will deploy the smart contract to
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
console.log('zkApp Address:', zkAppAddress.toBase58());

// ----------------------------------------------------
// Create an instance of IncrementSecret zkApp contract - and deploy it to zkAppAddress
await IncrementSecret.compile();
const zkAppInstance = new IncrementSecret(zkAppAddress);
const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
  zkAppInstance.initState(salt, Field(750));
});
await deployTxn.prove();
await deployTxn.sign([deployerKey]).send();

// ----------------------------------------------------
// Get the initial state of IncrementSecret after deployment
const num0 = zkAppInstance.x.get();
console.log('State after init:', num0.toString());

// ----------------------------------------------------
// Perform update to the zkApp state
const txn1 = await Mina.transaction(deployerAccount, () => {
  zkAppInstance.incrementSecret(salt, Field(750));
});

await txn1.prove();
await txn1.sign([deployerKey]).send();

const num1 = zkAppInstance.x.get();
console.log('state after txn1:', num1.toString());

// ----------------------------------------------------

console.log('Main02 Finished');
