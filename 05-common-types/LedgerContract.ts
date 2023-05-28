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

import {
  Field,
  SmartContract,
  state,
  State,
  method,
  MerkleWitness,
  Poseidon,
  PublicKey,
  Signature,
  Circuit,
} from 'snarkyjs';

class MerkleWitness20 extends MerkleWitness(20) {}

export class LedgerContract extends SmartContract {
  @state(Field) ledgerRoot = State<Field>();

  @method initState(initialLedgerRoot: Field) {
    this.ledgerRoot.set(initialLedgerRoot);
  }

  @method sendBalance(
    senderWitness: MerkleWitness20,
    recipientWitness: MerkleWitness20,
    senderBalanceBefore: Field,
    recipientBalanceBefore: Field,
    senderPublicKey: PublicKey,
    recipientPublicKey: PublicKey,
    senderSignature: Signature,
    sendAmount: Field
  ) {
    const initialLedgerRoot = this.ledgerRoot.get();
    this.ledgerRoot.assertEquals(initialLedgerRoot);

    // check the sender's signature
    senderSignature
      .verify(
        senderPublicKey,
        [initialLedgerRoot, sendAmount].concat(recipientPublicKey.toFields())
      )
      .assertTrue();

    // check the initial state matches what we expect
    const rootSenderBefore = senderWitness.calculateRoot(
      Poseidon.hash([
        Field(senderBalanceBefore),
        Poseidon.hash(senderPublicKey.toFields()),
      ])
    );
    rootSenderBefore.assertEquals(initialLedgerRoot);

    senderBalanceBefore.assertGte(sendAmount);

    // compute the sender state after sending
    const rootSenderAfter = senderWitness.calculateRoot(
      Poseidon.hash([
        Field(senderBalanceBefore).sub(sendAmount),
        Poseidon.hash(senderPublicKey.toFields()),
      ])
    );

    // compute the possible recipient states before receiving
    const rootRecipientBefore = recipientWitness.calculateRoot(
      Poseidon.hash([
        Field(recipientBalanceBefore),
        Poseidon.hash(recipientPublicKey.toFields()),
      ])
    );
    const rootRecipientBeforeEmpty = recipientWitness.calculateRoot(Field.zero);

    const recipientAccountNew = rootSenderAfter.equals(
      rootRecipientBeforeEmpty
    );

    // check requirements on the recipient state before receiving
    const recipientAccountPassesRequirements = Circuit.if(
      recipientAccountNew,
      (() => {
        // new account
        // balance before must be zero
        return recipientBalanceBefore.equals(Field.zero);
      })(),
      (() => {
        // existing account
        // check existing account witness
        return rootSenderAfter.equals(rootRecipientBefore);
      })()
    );

    recipientAccountPassesRequirements.assertTrue();

    // compute the recipient state after receiving
    const rootRecipientAfter = recipientWitness.calculateRoot(
      Poseidon.hash([
        Field(recipientBalanceBefore).add(sendAmount),
        Poseidon.hash(recipientPublicKey.toFields()),
      ])
    );

    // set the new ledgerRoot
    this.ledgerRoot.set(rootRecipientAfter);
  }
}
