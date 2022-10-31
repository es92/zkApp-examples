import { NumberTreeContract } from './NumberTreeContract.js';
import { OffChainStorage, MerkleWitness8 } from 'zkapp-offchain-storage';

import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Group,
  Character,
  CircuitString,
  Signature,
  Field,
  Bool,
  shutdown,
} from 'snarkyjs';

import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest =
  XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

async function main() {
  await isReady;

  // ----------------------------------------

  const transactionFee = 100_000_000;

  const treeHeight = 8;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const feePayerKey = Local.testAccounts[0].privateKey;

  const zkappPrivateKey = PrivateKey.random();
  const zkappPublicKey = zkappPrivateKey.toPublicKey();

  const zkapp = new NumberTreeContract(zkappPublicKey);

  // ----------------------------------------
  // deploy and initialize the smart contract

  const storageServerAddress = 'http://localhost:3001';
  const serverPublicKey = await OffChainStorage.getPublicKey(
    storageServerAddress,
    NodeXMLHttpRequest
  );

  const transaction = await Mina.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey: zkappPrivateKey });
    zkapp.init(serverPublicKey);
    zkapp.sign(zkappPrivateKey);
  });

  await transaction.send().wait();

  // ----------------------------------------
  // update the smart contract

  const height = 8;

  async function updateTree() {

    const index = Math.floor(Math.random() * 4);

    // get the existing tree
    const treeRoot = await zkapp.storageTreeRoot.get();
    const idx2fields = await OffChainStorage.get(
      storageServerAddress,
      zkappPublicKey,
      treeHeight,
      treeRoot,
      NodeXMLHttpRequest
    );

    const tree = OffChainStorage.mapToTree(treeHeight, idx2fields);
    const leafWitness = new MerkleWitness8(tree.getWitness(BigInt(index)));

    // get the prior leaf
    const priorLeafIsEmpty = !idx2fields.has(index);
    let priorLeafNumber: Field;
    let newLeafNumber: Field;
    if (!priorLeafIsEmpty) {
      priorLeafNumber = idx2fields.get(index)![0];
      newLeafNumber = priorLeafNumber.add(3);
    } else {
      priorLeafNumber = Field.zero;
      newLeafNumber = Field.one;
    }

    // update the leaf, and save it in the storage server
    idx2fields.set(index, [ newLeafNumber ]);

    const [storedNewStorageNumber, storedNewStorageSignature] =
      await OffChainStorage.requestStore(
        storageServerAddress,
        zkappPublicKey,
        treeHeight,
        idx2fields,
        NodeXMLHttpRequest
      );

    console.log('changing index', index, 'from',  priorLeafNumber.toString(), 'to', newLeafNumber.toString());

    // update the smart contract
    const updateTransaction = await Mina.transaction(
      { feePayerKey, fee: transactionFee },
      () => {
        zkapp!.update(
          Bool(priorLeafIsEmpty),
          priorLeafNumber,
          newLeafNumber,
          leafWitness,
          storedNewStorageNumber,
          storedNewStorageSignature
        );
        zkapp.sign(zkappPrivateKey);
      }
    );

    await updateTransaction.send().wait();

    console.log('root updated to', zkapp.storageTreeRoot.get().toString());

  }

  for (;;) {
    await updateTree();
  }

  //---------------------------

  await shutdown();
}

main();
