import { users, MessageBoard } from './message.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  SelfProof,
  Experimental,
  Struct,
  Bool,
  Circuit,
  Poseidon,
  MerkleMap,
  MerkleTree,
  MerkleWitness,
  MerkleMapWitness,
  verify,
} from 'snarkyjs';

class MerkleWitness20 extends MerkleWitness(20) {}

async function main() {
  await isReady;

  console.log('SnarkyJS loaded');

  console.log('compiling...');

  const { verificationKey } = await MessageBoard.compile();

  console.log('Initializing MessageBoard');

  // const proof0 = await MessageBoard.init();

  // console.log('making proof 1');

  // const proof1 = await MessageBoard.publishMessage(Field(4), users.Bob);

  console.log('Shutting down');

  await shutdown();
}

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
        earlierProof: SelfProof<Field>,
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
        earlierProof1: SelfProof<Field>,
        earlierProof2: SelfProof<Field>
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
main();
