import { Square } from './Square.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
} from 'snarkyjs';

function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  return Local.testAccounts[0].privateKey;
}

(async function main() {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  await isReady;

  // ---------------------------------------

  deployerAccount = createLocalBlockchain();
  zkAppPrivateKey = PrivateKey.random();
  zkAppAddress = zkAppPrivateKey.toPublicKey();

  // ---------------------------------------

  const zkAppInstance = new Square(zkAppAddress);
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
    zkAppInstance.init();
    zkAppInstance.sign(zkAppPrivateKey);
  });
  await deploy_txn.send().wait();

  const num0 = zkAppInstance.num.get();
  console.log('state after init:', num0.toString());

  // ---------------------------------------

  const txn1 = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.update(Field.fromNumber(9));
    zkAppInstance.sign(zkAppPrivateKey);
  });
  await txn1.send().wait();

  const num1 = zkAppInstance.num.get();
  console.log('state after txn1:', num1.toString());

  // ---------------------------------------

  try {
    const txn2 = await Mina.transaction(deployerAccount, () => {
      zkAppInstance.update(Field.fromNumber(75));
      zkAppInstance.sign(zkAppPrivateKey);
    });
    await txn2.send().wait();
  } catch (ex: any) {
    console.log(ex.message);
  }
  const num2 = zkAppInstance.num.get();
  console.log('state after txn2:', num2.toString());

  // ---------------------------------------

  const txn3 = await Mina.transaction(deployerAccount, () => {
    zkAppInstance.update(Field.fromNumber(81));
    zkAppInstance.sign(zkAppPrivateKey);
  });
  await txn3.send().wait();

  const num3 = zkAppInstance.num.get();
  console.log('state after txn3:', num3.toString());

  // ---------------------------------------

  await shutdown();
})();
