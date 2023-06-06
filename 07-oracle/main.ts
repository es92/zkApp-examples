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

import { OracleExample } from './CreditScoreOracle.js';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'snarkyjs';

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
await txn.prove();
await txn.sign([deployerKey]).send();

const events = await zkAppInstance.fetchEvents();
const verifiedEventValue = events[0].event.data.toFields(null)[0];

console.log('Event received: ', verifiedEventValue);

// ----------------------------------------------------

console.log('Main07 Finished');
