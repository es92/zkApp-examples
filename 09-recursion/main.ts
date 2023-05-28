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
  SelfProof,
  Experimental,
  MerkleWitness,
  verify,
} from 'snarkyjs';

class MerkleWitness20 extends MerkleWitness(20) {}

const Add = Experimental.ZkProgram({
  publicInput: Field,

  methods: {
    init: {
      privateInputs: [],

      method(state: Field) {
        state.assertEquals(Field(0));
      },
    },

    addNumber: {
      privateInputs: [SelfProof, Field],

      method(
        newState: Field,
        earlierProof: SelfProof<Field, Field>,
        numberToAdd: Field
      ) {
        earlierProof.verify();
        newState.assertEquals(earlierProof.publicInput.add(numberToAdd));
      },
    },

    add: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: Field,
        earlierProof1: SelfProof<Field, Field>,
        earlierProof2: SelfProof<Field, Field>
      ) {
        earlierProof1.verify();
        earlierProof2.verify();
        newState.assertEquals(
          earlierProof1.publicInput.add(earlierProof2.publicInput)
        );
      },
    },
  },
});

console.log('SnarkyJS loaded');

console.log('compiling...');

const { verificationKey } = await Add.compile();

console.log('making proof 0');

const proof0 = await Add.init(Field(0));

console.log('making proof 1');

const proof1 = await Add.addNumber(Field(4), proof0, Field(4));

console.log('making proof 2');

const proof2 = await Add.add(Field(4), proof1, proof0);

console.log('verifying proof 2');
console.log('proof 2 data', proof2.publicInput.toString());

const ok = await verify(proof2.toJSON(), verificationKey);
console.log('ok', ok);

// ----------------------------------------------------

console.log('Main09 Finished');
