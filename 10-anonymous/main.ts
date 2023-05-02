import { exit } from 'process';
import { users, MessageBoard } from './message.js';
import {
  isReady,
  shutdown,
  Field,
  AccountUpdate,
  PrivateKey,
  Mina,
} from 'snarkyjs';

async function main() {
  await isReady;
  let useProof = false;
  console.log('SnarkyJS loaded');

  console.log('compiling...');

  try {
    const { verificationKey } = await MessageBoard.compile();
  } catch (err) {
    console.log('Error during compilation: ', err);
    exit(1);
  }

  const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
  Mina.setActiveInstance(Local);
  const { privateKey: deployerKey, publicKey: deployerAccount } =
    Local.testAccounts[0];

  console.log('Initializing MessageBoard');

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  const zkAppInstance = new MessageBoard(zkAppAddress);

  let tx1 = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    // NOTE: this calls `init()` if this is the first deploy
    zkAppInstance.deploy({});
  });

  await tx1.prove();
  await tx1.sign([deployerKey, zkAppPrivateKey]).send();

  console.log(
    'MessageBoard init stored message:',
    zkAppInstance.message.get().toString()
  );
  console.log(
    'MessageBoard message hash:',
    zkAppInstance.messageHistoryHash.get().toString()
  );

  let tx2 = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.publishMessage(Field(4), users.Bob);
  });

  await tx2.prove();
  await tx2.sign([deployerKey, zkAppPrivateKey]).send();

  console.log(
    'MessageBoard Bob stored message:',
    zkAppInstance.message.get().toString()
  );
  console.log(
    'MessageBoard message hash:',
    zkAppInstance.messageHistoryHash.get().toString()
  );

  console.log('Shutting down');

  await shutdown();
}

main();
